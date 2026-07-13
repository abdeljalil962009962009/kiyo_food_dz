-- Application-owned Supabase security remediation.
-- PostGIS and other extension-owned objects are intentionally excluded.
BEGIN;

REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Every application-owned function must have an explicit path and no implicit
-- PUBLIC/anon execution. Extension-owned routines are excluded by pg_depend.
DO $security$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature, p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_function.signature);
    IF NOT EXISTS (
      SELECT 1 FROM unnest(COALESCE(v_function.proconfig, ARRAY[]::text[])) setting
      WHERE setting LIKE 'search_path=%'
    ) THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path TO public, pg_temp', v_function.signature);
    END IF;
  END LOOP;
END
$security$;

-- Trigger, maintenance, audit, owner-bootstrap and privileged routines must
-- never be directly callable by a browser session.
DO $privileges$
DECLARE
  v_function record;
  v_restricted_names text[] := ARRAY[
    'archive_old_notifications', 'award_loyalty_points',
    'cleanup_old_location_data', 'create_financial_ledger_entry',
    'detect_suspicious_driver_location', 'generate_monthly_settlement',
    'get_admin_alerts', 'get_platform_analytics', 'get_settlement_overview',
    'get_top_restaurants', 'guard_locked_ledger', 'guard_order_domain_updates',
    'guard_restaurant_lifecycle_status', 'handle_new_user',
    'hard_delete_expired_profiles', 'increment_promo_usage',
    'is_owner_initialized', 'kiyo_sync_driver_geo',
    'kiyo_sync_driver_location_event_geo', 'kiyo_sync_order_delivery_geo',
    'kiyo_sync_restaurant_geo', 'kiyo_sync_saved_address_geo',
    'log_activity', 'log_order_status_change', 'manually_assign_owner',
    'mark_settlement_paid', 'notify_new_order', 'notify_order_stakeholders',
    'notify_order_status_change', 'notify_user', 'promote_owner_on_login',
    'publish_restaurant', 'refresh_restaurant_rating',
    'remove_marketplace_rule_override', 'review_restaurant_application',
    'set_marketplace_rule_override', 'set_restaurant_status', 'set_updated_at',
    'set_user_suspended', 'touch_restaurant_application_updated_at',
    'update_platform_setting', 'update_recent_orders_summary',
    'update_restaurant_admin', 'update_restaurant_analytics',
    'update_restaurant_application_internal_notes', 'update_restaurant_rating',
    'update_ticket_status', 'update_ticket_timestamp',
    'validate_platform_setting_row', 'force_close_order',
    'preliminarily_approve_restaurant_application'
  ];
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(v_restricted_names)
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', v_function.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function.signature);
  END LOOP;
END
$privileges$;

-- Keep only genuinely public, bounded, read-only location RPCs available to
-- logged-out visitors. Their implementations expose published restaurants only.
GRANT EXECUTE ON FUNCTION public.nearby_restaurants(double precision, double precision, numeric, integer)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_location_insights(double precision, double precision)
  TO anon, authenticated;

-- Owner actions are idempotent and can only enter through the trusted Vercel
-- function using the service role. Browser clients cannot read this table.
CREATE TABLE IF NOT EXISTS public.owner_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL,
  action text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, request_id)
);
ALTER TABLE public.owner_action_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.owner_action_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.owner_action_requests TO service_role;

CREATE OR REPLACE FUNCTION public.execute_owner_action(
  p_actor_id uuid,
  p_request_id uuid,
  p_action text,
  p_args jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_existing public.owner_action_requests%ROWTYPE;
  v_is_read boolean := p_action IN (
    'get_platform_analytics', 'get_admin_alerts', 'get_settlement_overview'
  );
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.' USING ERRCODE = '42501';
  END IF;
  IF p_actor_id IS NULL OR p_request_id IS NULL OR jsonb_typeof(COALESCE(p_args, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid owner action request.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_actor_id AND p.role = 'super_admin' AND NOT COALESCE(p.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'Only an active platform owner may perform this action.' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_read THEN
    INSERT INTO public.owner_action_requests (actor_id, request_id, action, args)
    VALUES (p_actor_id, p_request_id, p_action, COALESCE(p_args, '{}'::jsonb))
    ON CONFLICT (actor_id, request_id) DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO v_existing FROM public.owner_action_requests
      WHERE actor_id = p_actor_id AND request_id = p_request_id;
      IF v_existing.action <> p_action OR v_existing.args <> COALESCE(p_args, '{}'::jsonb) THEN
        RAISE EXCEPTION 'Idempotency key was reused for a different action.' USING ERRCODE = 'PT409';
      END IF;
      IF v_existing.completed_at IS NULL THEN
        RAISE EXCEPTION 'This owner action is already being processed.' USING ERRCODE = 'PT409';
      END IF;
      RETURN v_existing.result;
    END IF;
  END IF;

  -- Existing canonical routines use auth.uid() for authorization and auditing.
  -- The actor is derived from the verified access token by the trusted server.
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
        NULLIF(p_args->>'p_is_featured', '')::boolean
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
      RAISE EXCEPTION 'Owner action is not allowlisted.' USING ERRCODE = '42501';
  END CASE;

  IF NOT v_is_read THEN
    UPDATE public.owner_action_requests
    SET result = COALESCE(v_result, 'null'::jsonb), completed_at = now()
    WHERE actor_id = p_actor_id AND request_id = p_request_id;
  END IF;
  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION public.execute_owner_action(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_owner_action(uuid, uuid, text, jsonb)
  TO service_role;

-- Remove always-true and unnecessarily broad application policies.
DROP POLICY IF EXISTS search_logs_insert ON public.search_logs;
CREATE POLICY search_logs_insert ON public.search_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND length(trim(query)) BETWEEN 1 AND 200
    AND COALESCE(results_count, 0) BETWEEN 0 AND 10000
    AND created_at >= now() - interval '5 minutes'
    AND created_at <= now() + interval '1 minute'
  );

DROP POLICY IF EXISTS settings_select ON public.platform_settings;
CREATE POLICY settings_select ON public.platform_settings
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR key IN ('features', 'maintenance', 'order_rules', 'branding', 'currency')
  );

DROP POLICY IF EXISTS owner_config_select ON public.owner_init_config;
CREATE POLICY owner_config_select ON public.owner_init_config
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS platform_health_select ON public.platform_health;
CREATE POLICY platform_health_select ON public.platform_health
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS zones_select ON public.delivery_zones;
CREATE POLICY zones_select ON public.delivery_zones
  FOR SELECT TO authenticated USING (is_active OR public.is_super_admin());

DROP POLICY IF EXISTS campaigns_select ON public.marketing_campaigns;
CREATE POLICY campaigns_select ON public.marketing_campaigns
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS flags_select ON public.feature_flags;
CREATE POLICY flags_select ON public.feature_flags
  FOR SELECT TO authenticated USING (is_enabled OR public.is_super_admin());

DROP POLICY IF EXISTS subscription_plans_select ON public.subscription_plans;
CREATE POLICY subscription_plans_select ON public.subscription_plans
  FOR SELECT TO authenticated USING (is_active OR public.is_super_admin());

-- Restaurant application media contains private onboarding documents. Existing
-- objects remain in place; legacy URL values are resolved as signed URLs by the app.
UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'restaurant-applications';

DROP POLICY IF EXISTS restaurant_applications_storage_read ON storage.objects;
DROP POLICY IF EXISTS restaurant_applications_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS restaurant_applications_storage_update_own ON storage.objects;
DROP POLICY IF EXISTS restaurant_applications_storage_delete_own ON storage.objects;

CREATE POLICY restaurant_applications_storage_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'restaurant-applications'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_super_admin()
    )
  );

CREATE POLICY restaurant_applications_storage_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

CREATE POLICY restaurant_applications_storage_update_own
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'restaurant-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'restaurant-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

CREATE POLICY restaurant_applications_storage_delete_own
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'restaurant-applications'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
