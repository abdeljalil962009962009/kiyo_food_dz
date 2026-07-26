-- Protect discount, campaign, feature-flag and subscription-plan governance.
-- Existing records remain unchanged; browser writes move behind a verified owner action.

BEGIN;

ALTER TABLE public.promo_codes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS promo_insert_admin ON public.promo_codes;
DROP POLICY IF EXISTS promo_update_admin ON public.promo_codes;
DROP POLICY IF EXISTS promo_delete_admin ON public.promo_codes;
DROP POLICY IF EXISTS campaigns_modify ON public.marketing_campaigns;
DROP POLICY IF EXISTS flags_modify ON public.feature_flags;
DROP POLICY IF EXISTS subscription_plans_modify ON public.subscription_plans;

CREATE OR REPLACE FUNCTION public.manage_marketing_control(
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
  v_existing_request public.owner_action_requests%ROWTYPE;
  v_promo public.promo_codes%ROWTYPE;
  v_campaign public.marketing_campaigns%ROWTYPE;
  v_flag public.feature_flags%ROWTYPE;
  v_plan public.subscription_plans%ROWTYPE;
  v_id uuid;
  v_expected_updated_at timestamptz;
  v_enabled boolean;
  v_name text;
  v_description text;
  v_code text;
  v_discount_type text;
  v_discount_value numeric;
  v_min_order numeric;
  v_max_discount numeric;
  v_valid_until timestamptz;
  v_campaign_type text;
  v_audience text;
  v_message text;
  v_plan_type text;
  v_price numeric;
  v_result jsonb;
  v_target_type text;
  v_target_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.' USING ERRCODE = '42501';
  END IF;
  IF p_actor_id IS NULL
     OR p_request_id IS NULL
     OR p_action NOT IN (
       'create_promo_code',
       'set_promo_code_active',
       'create_marketing_campaign',
       'set_marketing_campaign_active',
       'set_feature_flag_enabled',
       'create_subscription_plan',
       'set_subscription_plan_active'
     )
     OR jsonb_typeof(COALESCE(p_args, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid marketing control request.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'super_admin'
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'Only an active platform owner can change marketing controls.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.owner_action_requests (actor_id, request_id, action, args)
  VALUES (p_actor_id, p_request_id, p_action, COALESCE(p_args, '{}'::jsonb))
  ON CONFLICT (actor_id, request_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT request.*
    INTO v_existing_request
    FROM public.owner_action_requests AS request
    WHERE request.actor_id = p_actor_id
      AND request.request_id = p_request_id;
    IF v_existing_request.action IS DISTINCT FROM p_action
       OR v_existing_request.args IS DISTINCT FROM COALESCE(p_args, '{}'::jsonb) THEN
      RAISE EXCEPTION 'Idempotency key was reused for a different action.'
        USING ERRCODE = 'PT409';
    END IF;
    IF v_existing_request.completed_at IS NULL THEN
      RAISE EXCEPTION 'This marketing action is already being processed.'
        USING ERRCODE = 'PT409';
    END IF;
    RETURN v_existing_request.result;
  END IF;

  CASE p_action
    WHEN 'create_promo_code' THEN
      v_code := upper(trim(COALESCE(p_args->>'p_code', '')));
      v_description := NULLIF(trim(COALESCE(p_args->>'p_description', '')), '');
      v_discount_type := COALESCE(p_args->>'p_discount_type', '');
      v_discount_value := NULLIF(p_args->>'p_discount_value', '')::numeric;
      v_min_order := COALESCE(NULLIF(p_args->>'p_min_order_amount', '')::numeric, 0);
      v_max_discount := NULLIF(p_args->>'p_max_discount', '')::numeric;
      v_valid_until := NULLIF(p_args->>'p_valid_until', '')::timestamptz;

      IF v_code !~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'
         OR length(COALESCE(v_description, '')) > 240
         OR v_discount_type NOT IN ('percentage', 'fixed')
         OR v_discount_value IS NULL
         OR v_discount_value <= 0
         OR (v_discount_type = 'percentage' AND v_discount_value > 100)
         OR v_min_order < 0
         OR (v_max_discount IS NOT NULL AND v_max_discount <= 0)
         OR (v_valid_until IS NOT NULL AND v_valid_until <= now()) THEN
        RAISE EXCEPTION 'Promo code values are invalid.' USING ERRCODE = '22023';
      END IF;

      INSERT INTO public.promo_codes (
        code, description, discount_type, discount_value, min_order_amount,
        max_discount, valid_until, is_active, created_by, updated_by
      )
      VALUES (
        v_code, v_description, v_discount_type, v_discount_value, v_min_order,
        v_max_discount, v_valid_until, true, p_actor_id, p_actor_id
      )
      RETURNING * INTO v_promo;
      v_result := to_jsonb(v_promo);
      v_target_type := 'promo_code';
      v_target_id := v_promo.id;

    WHEN 'set_promo_code_active' THEN
      v_id := NULLIF(p_args->>'p_promo_id', '')::uuid;
      v_enabled := NULLIF(p_args->>'p_active', '')::boolean;
      v_expected_updated_at := NULLIF(p_args->>'p_expected_updated_at', '')::timestamptz;
      SELECT promo.* INTO v_promo
      FROM public.promo_codes AS promo
      WHERE promo.id = v_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Promo code was not found.' USING ERRCODE = 'P0002'; END IF;
      IF v_enabled IS NULL OR v_expected_updated_at IS NULL
         OR v_promo.updated_at IS DISTINCT FROM v_expected_updated_at THEN
        RAISE EXCEPTION 'Promo code changed in another session. Refresh before trying again.'
          USING ERRCODE = '40001';
      END IF;
      UPDATE public.promo_codes AS promo
      SET is_active = v_enabled, updated_at = now(), updated_by = p_actor_id
      WHERE promo.id = v_id
      RETURNING promo.* INTO v_promo;
      v_result := to_jsonb(v_promo);
      v_target_type := 'promo_code';
      v_target_id := v_promo.id;

    WHEN 'create_marketing_campaign' THEN
      v_name := trim(COALESCE(p_args->>'p_name', ''));
      v_campaign_type := COALESCE(p_args->>'p_campaign_type', '');
      v_audience := COALESCE(p_args->>'p_target_audience', '');
      v_message := trim(COALESCE(p_args->>'p_message', ''));
      IF length(v_name) NOT BETWEEN 2 AND 120
         OR v_campaign_type NOT IN ('coupon', 'push', 'email', 'in_app', 'loyalty')
         OR v_audience NOT IN ('all', 'customers', 'owners', 'inactive')
         OR length(v_message) NOT BETWEEN 2 AND 1000 THEN
        RAISE EXCEPTION 'Campaign values are invalid.' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.marketing_campaigns (
        name, campaign_type, target_audience, content, is_active, created_by, updated_by
      )
      VALUES (
        v_name, v_campaign_type, v_audience,
        jsonb_build_object('message', v_message), false, p_actor_id, p_actor_id
      )
      RETURNING * INTO v_campaign;
      v_result := to_jsonb(v_campaign);
      v_target_type := 'marketing_campaign';
      v_target_id := v_campaign.id;

    WHEN 'set_marketing_campaign_active' THEN
      v_id := NULLIF(p_args->>'p_campaign_id', '')::uuid;
      v_enabled := NULLIF(p_args->>'p_active', '')::boolean;
      v_expected_updated_at := NULLIF(p_args->>'p_expected_updated_at', '')::timestamptz;
      SELECT campaign.* INTO v_campaign
      FROM public.marketing_campaigns AS campaign
      WHERE campaign.id = v_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Campaign was not found.' USING ERRCODE = 'P0002'; END IF;
      IF v_enabled IS NULL OR v_expected_updated_at IS NULL
         OR v_campaign.updated_at IS DISTINCT FROM v_expected_updated_at THEN
        RAISE EXCEPTION 'Campaign changed in another session. Refresh before trying again.'
          USING ERRCODE = '40001';
      END IF;
      UPDATE public.marketing_campaigns AS campaign
      SET is_active = v_enabled, updated_at = now(), updated_by = p_actor_id
      WHERE campaign.id = v_id
      RETURNING campaign.* INTO v_campaign;
      v_result := to_jsonb(v_campaign);
      v_target_type := 'marketing_campaign';
      v_target_id := v_campaign.id;

    WHEN 'set_feature_flag_enabled' THEN
      v_id := NULLIF(p_args->>'p_flag_id', '')::uuid;
      v_enabled := NULLIF(p_args->>'p_enabled', '')::boolean;
      v_expected_updated_at := NULLIF(p_args->>'p_expected_updated_at', '')::timestamptz;
      SELECT flag.* INTO v_flag
      FROM public.feature_flags AS flag
      WHERE flag.id = v_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Feature control was not found.' USING ERRCODE = 'P0002'; END IF;
      IF v_enabled IS NULL OR v_expected_updated_at IS NULL
         OR v_flag.updated_at IS DISTINCT FROM v_expected_updated_at THEN
        RAISE EXCEPTION 'Feature control changed in another session. Refresh before trying again.'
          USING ERRCODE = '40001';
      END IF;
      UPDATE public.feature_flags AS flag
      SET is_enabled = v_enabled, updated_at = now(), updated_by = p_actor_id
      WHERE flag.id = v_id
      RETURNING flag.* INTO v_flag;
      v_result := to_jsonb(v_flag);
      v_target_type := 'feature_flag';
      v_target_id := v_flag.id;

    WHEN 'create_subscription_plan' THEN
      v_name := trim(COALESCE(p_args->>'p_name', ''));
      v_plan_type := COALESCE(p_args->>'p_plan_type', '');
      v_price := NULLIF(p_args->>'p_price_monthly', '')::numeric;
      v_description := NULLIF(trim(COALESCE(p_args->>'p_features_description', '')), '');
      IF length(v_name) NOT BETWEEN 2 AND 120
         OR v_plan_type NOT IN ('customer', 'restaurant', 'driver')
         OR v_price IS NULL OR v_price < 0 OR v_price > 1000000
         OR length(COALESCE(v_description, '')) > 500 THEN
        RAISE EXCEPTION 'Subscription plan values are invalid.' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.subscription_plans (
        name, plan_type, price_monthly, features, is_active, updated_by
      )
      VALUES (
        v_name, v_plan_type, v_price,
        jsonb_build_object('description', COALESCE(v_description, '')), true, p_actor_id
      )
      RETURNING * INTO v_plan;
      v_result := to_jsonb(v_plan);
      v_target_type := 'subscription_plan';
      v_target_id := v_plan.id;

    WHEN 'set_subscription_plan_active' THEN
      v_id := NULLIF(p_args->>'p_plan_id', '')::uuid;
      v_enabled := NULLIF(p_args->>'p_active', '')::boolean;
      v_expected_updated_at := NULLIF(p_args->>'p_expected_updated_at', '')::timestamptz;
      SELECT plan.* INTO v_plan
      FROM public.subscription_plans AS plan
      WHERE plan.id = v_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Subscription plan was not found.' USING ERRCODE = 'P0002'; END IF;
      IF v_enabled IS NULL OR v_expected_updated_at IS NULL
         OR v_plan.updated_at IS DISTINCT FROM v_expected_updated_at THEN
        RAISE EXCEPTION 'Subscription plan changed in another session. Refresh before trying again.'
          USING ERRCODE = '40001';
      END IF;
      UPDATE public.subscription_plans AS plan
      SET is_active = v_enabled, updated_at = now(), updated_by = p_actor_id
      WHERE plan.id = v_id
      RETURNING plan.* INTO v_plan;
      v_result := to_jsonb(v_plan);
      v_target_type := 'subscription_plan';
      v_target_id := v_plan.id;
  END CASE;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    p_actor_id,
    'platform_setting_updated',
    v_target_type,
    v_target_id,
    jsonb_build_object('control_action', p_action, 'request_id', p_request_id, 'result', v_result)
  );

  UPDATE public.owner_action_requests AS request
  SET result = v_result, completed_at = now()
  WHERE request.actor_id = p_actor_id
    AND request.request_id = p_request_id;
  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION public.manage_marketing_control(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_marketing_control(uuid, uuid, text, jsonb)
  TO service_role;

COMMIT;
