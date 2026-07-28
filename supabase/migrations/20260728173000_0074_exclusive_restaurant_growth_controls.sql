-- Add owner-controlled restaurant growth signals without rewriting existing data.
-- Safe/additive: no drops, no deletes, no destructive column changes.

BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS is_exclusive_to_kiyo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fair_commission_message text;

CREATE INDEX IF NOT EXISTS idx_restaurants_published_exclusive
  ON public.restaurants (wilaya_id, rating DESC)
  WHERE status = 'published' AND is_exclusive_to_kiyo = true;

CREATE OR REPLACE FUNCTION public.update_restaurant_admin(
  p_restaurant_id uuid,
  p_status text DEFAULT NULL,
  p_is_verified boolean DEFAULT NULL,
  p_is_featured boolean DEFAULT NULL,
  p_is_exclusive_to_kiyo boolean DEFAULT NULL,
  p_fair_commission_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_message text := NULLIF(trim(COALESCE(p_fair_commission_message, '')), '');
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can update restaurants.' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('draft','pending_approval','published','hidden','suspended') THEN
    RAISE EXCEPTION 'Invalid restaurant status.' USING ERRCODE = '22023';
  END IF;
  IF v_message IS NOT NULL AND length(v_message) > 180 THEN
    RAISE EXCEPTION 'Fair commission message is too long.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.restaurants
  SET status = COALESCE(p_status::public.restaurant_status, status),
      is_verified = COALESCE(p_is_verified, is_verified),
      is_featured = COALESCE(p_is_featured, is_featured),
      is_exclusive_to_kiyo = COALESCE(p_is_exclusive_to_kiyo, is_exclusive_to_kiyo),
      fair_commission_message = CASE
        WHEN p_fair_commission_message IS NOT NULL THEN v_message
        WHEN p_is_exclusive_to_kiyo IS FALSE THEN NULL
        ELSE fair_commission_message
      END,
      featured_until = CASE
        WHEN p_is_featured IS TRUE THEN now() + interval '30 days'
        WHEN p_is_featured IS FALSE THEN NULL
        ELSE featured_until
      END,
      updated_at = now()
  WHERE id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_activity(
    'admin_action',
    'restaurant',
    p_restaurant_id,
    jsonb_build_object(
      'status', p_status,
      'verified', p_is_verified,
      'featured', p_is_featured,
      'exclusive_to_kiyo', p_is_exclusive_to_kiyo,
      'fair_commission_message_set', v_message IS NOT NULL
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_restaurant_admin(uuid, text, boolean, boolean, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_restaurant_admin(uuid, text, boolean, boolean, boolean, text)
  TO service_role;
DO $$
BEGIN
  IF to_regprocedure('public.update_restaurant_admin(uuid,text,boolean,boolean)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.update_restaurant_admin(uuid, text, boolean, boolean)
      FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_owner_action(
  p_actor_id uuid,
  p_request_id uuid,
  p_action text,
  p_args jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_existing public.owner_action_requests%ROWTYPE;
  v_result jsonb := '{}'::jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.' USING ERRCODE = '42501';
  END IF;
  IF p_actor_id IS NULL OR p_request_id IS NULL OR p_action IS NULL
     OR jsonb_typeof(COALESCE(p_args, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid owner action request.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'super_admin'
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'Only an active platform owner can perform this action.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.owner_action_requests (actor_id, request_id, action, args)
  VALUES (p_actor_id, p_request_id, p_action, COALESCE(p_args, '{}'::jsonb))
  ON CONFLICT (actor_id, request_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT request.* INTO v_existing
    FROM public.owner_action_requests request
    WHERE request.actor_id = p_actor_id
      AND request.request_id = p_request_id;
    IF v_existing.action IS DISTINCT FROM p_action
       OR v_existing.args IS DISTINCT FROM COALESCE(p_args, '{}'::jsonb) THEN
      RAISE EXCEPTION 'Idempotency key was reused for a different owner action.' USING ERRCODE = 'PT409';
    END IF;
    IF v_existing.completed_at IS NULL THEN
      RAISE EXCEPTION 'This owner action is already being processed.' USING ERRCODE = 'PT409';
    END IF;
    RETURN v_existing.result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', p_actor_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_actor_id, 'role', 'authenticated')::text,
    true
  );

  CASE p_action
    WHEN 'get_platform_analytics' THEN
      v_result := public.get_platform_analytics();
    WHEN 'get_admin_alerts' THEN
      v_result := public.get_admin_alerts();
    WHEN 'get_settlement_overview' THEN
      v_result := public.get_settlement_overview();
    WHEN 'generate_monthly_settlement' THEN
      v_result := public.generate_monthly_settlement(
        (p_args->>'p_restaurant_id')::uuid,
        (p_args->>'p_period_start')::date
      );
    WHEN 'mark_settlement_paid' THEN
      v_result := public.mark_settlement_paid(
        (p_args->>'p_settlement_id')::uuid,
        NULLIF(p_args->>'p_amount', '')::numeric,
        NULLIF(p_args->>'p_notes', '')
      );
    WHEN 'set_user_suspended' THEN
      PERFORM public.set_user_suspended(
        (p_args->>'p_user_id')::uuid,
        (p_args->>'p_suspended')::boolean,
        NULLIF(p_args->>'p_reason', '')
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'update_restaurant_admin' THEN
      PERFORM public.update_restaurant_admin(
        (p_args->>'p_restaurant_id')::uuid,
        NULLIF(p_args->>'p_status', ''),
        NULLIF(p_args->>'p_is_verified', '')::boolean,
        NULLIF(p_args->>'p_is_featured', '')::boolean,
        NULLIF(p_args->>'p_is_exclusive_to_kiyo', '')::boolean,
        NULLIF(p_args->>'p_fair_commission_message', '')
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'update_platform_setting' THEN
      PERFORM public.update_platform_setting(
        NULLIF(p_args->>'p_key', ''), p_args->'p_value'
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'update_ticket_status' THEN
      PERFORM public.update_ticket_status(
        (p_args->>'p_ticket_id')::uuid,
        NULLIF(p_args->>'p_status', ''),
        NULLIF(p_args->>'p_priority', '')
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'review_restaurant_application' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.review_restaurant_application(
        (p_args->>'p_application_id')::uuid,
        NULLIF(p_args->>'p_target_status', ''),
        NULLIF(p_args->>'p_reason', ''),
        NULLIF(p_args->>'p_expected_version', '')::integer
      ) result;
    WHEN 'preliminarily_approve_restaurant_application' THEN
      v_result := public.preliminarily_approve_restaurant_application(
        (p_args->>'p_application_id')::uuid,
        (p_args->>'p_food_commission_rate')::numeric,
        COALESCE(NULLIF(p_args->>'p_delivery_share_rate', '')::numeric, 0),
        COALESCE(NULLIF(p_args->>'p_commission_base', ''), 'food_subtotal'),
        NULLIF(p_args->>'p_note', ''),
        NULLIF(p_args->>'p_expected_version', '')::integer
      );
    WHEN 'publish_restaurant' THEN
      v_result := public.publish_restaurant(
        (p_args->>'p_restaurant_id')::uuid,
        NULLIF(p_args->>'p_expected_application_version', '')::integer
      );
    WHEN 'update_restaurant_application_internal_notes' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.update_restaurant_application_internal_notes(
        (p_args->>'p_application_id')::uuid,
        COALESCE(p_args->>'p_notes', ''),
        NULLIF(p_args->>'p_expected_version', '')::integer
      ) result;
    WHEN 'set_restaurant_status' THEN
      PERFORM public.set_restaurant_status(
        (p_args->>'p_restaurant_id')::uuid,
        (p_args->>'p_status')::public.restaurant_status
      );
      v_result := jsonb_build_object('ok', true);
    WHEN 'set_marketplace_rule_override' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.set_marketplace_rule_override(
        NULLIF(p_args->>'p_scope_type', ''),
        NULLIF(p_args->>'p_scope_id', ''),
        p_args->'p_values',
        COALESCE(NULLIF(p_args->>'p_effective_at', '')::timestamptz, now()),
        NULLIF(p_args->>'p_reason', ''),
        NULLIF(p_args->>'p_expected_version', '')::integer
      ) result;
    WHEN 'remove_marketplace_rule_override' THEN
      PERFORM public.remove_marketplace_rule_override(
        NULLIF(p_args->>'p_scope_type', ''),
        NULLIF(p_args->>'p_scope_id', ''),
        (p_args->>'p_expected_version')::integer,
        NULLIF(p_args->>'p_reason', '')
      );
      v_result := jsonb_build_object('ok', true);
    ELSE
      IF p_action IN (
        'create_promo_code',
        'set_promo_code_active',
        'create_marketing_campaign',
        'set_marketing_campaign_active',
        'set_feature_flag_enabled',
        'create_subscription_plan',
        'set_subscription_plan_active'
      ) THEN
        v_result := public.manage_marketing_control(p_actor_id, p_request_id, p_action, p_args);
      ELSIF p_action IN (
        'create_delivery_zone',
        'set_delivery_zone_active',
        'set_wilaya_active'
      ) THEN
        v_result := public.manage_geography_control(p_actor_id, p_request_id, p_action, p_args);
      ELSE
        RAISE EXCEPTION 'Unsupported owner action: %', p_action USING ERRCODE = '22023';
      END IF;
  END CASE;

  UPDATE public.owner_action_requests request
  SET result = v_result, completed_at = now()
  WHERE request.actor_id = p_actor_id
    AND request.request_id = p_request_id;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.execute_owner_action(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_owner_action(uuid, uuid, text, jsonb)
  TO service_role;

COMMIT;
