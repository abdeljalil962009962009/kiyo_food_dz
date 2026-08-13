-- Kiyo Food 0076: customer invite/referral claims and first-order rewards.
-- Additive except removing the old single-use UNIQUE constraint on referrals.code,
-- because one invite code must be reusable by many genuinely new customers.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS acquisition_source text NOT NULL DEFAULT 'organic',
  ADD COLUMN IF NOT EXISTS referred_by_code text;

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referred_phone text,
  ADD COLUMN IF NOT EXISTS first_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rewarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS referrer_reward_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referee_reward_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_code_key;

CREATE OR REPLACE FUNCTION public.kiyo_generate_referral_code(p_profile_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 'KF' || upper(substr(md5(p_profile_id::text), 1, 10));
$$;

CREATE OR REPLACE FUNCTION public.set_profile_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code !~ '^[A-Z0-9]{6,20}$' THEN
    NEW.referral_code := public.kiyo_generate_referral_code(NEW.id);
  ELSE
    NEW.referral_code := upper(regexp_replace(NEW.referral_code, '[^A-Z0-9]', '', 'g'));
  END IF;

  IF NEW.acquisition_source IS NULL OR trim(NEW.acquisition_source) = '' THEN
    NEW.acquisition_source := 'organic';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_referral_code
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_referral_code();

UPDATE public.profiles
SET referral_code = public.kiyo_generate_referral_code(id)
WHERE referral_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique
  ON public.profiles(referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_code_status
  ON public.referrals(code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referrals_referred_lookup
  ON public.referrals(referred_id)
  WHERE referred_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status
  ON public.referrals(referrer_id, status, created_at DESC);

-- Referrals are money-equivalent rewards. Keep reads for the owner/referee,
-- but force creation through the server-validated claim_referral_code RPC.
DROP POLICY IF EXISTS referrals_insert_own ON public.referrals;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid()
       OR NEW.role IS DISTINCT FROM 'customer'::public.user_role
       OR COALESCE(NEW.is_suspended, false)
       OR NEW.suspended_reason IS NOT NULL
       OR NEW.suspended_at IS NOT NULL
       OR COALESCE(NEW.failed_login_attempts, 0) <> 0
       OR NEW.locked_until IS NOT NULL
       OR NEW.deleted_at IS NOT NULL
       OR NEW.export_requested_at IS NOT NULL
       OR NEW.last_login_at IS NOT NULL
       OR NEW.last_login_ip IS NOT NULL
       OR NEW.referral_code IS NOT NULL
       OR NEW.referred_by_code IS NOT NULL
       OR COALESCE(NEW.acquisition_source, 'organic') <> 'organic' THEN
      RAISE EXCEPTION 'Protected profile fields can only be set by the trusted server.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.failed_login_attempts IS DISTINCT FROM OLD.failed_login_attempts
     OR NEW.locked_until IS DISTINCT FROM OLD.locked_until
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.export_requested_at IS DISTINCT FROM OLD.export_requested_at
     OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
     OR NEW.last_login_ip IS DISTINCT FROM OLD.last_login_ip
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.acquisition_source IS DISTINCT FROM OLD.acquisition_source
     OR NEW.referred_by_code IS DISTINCT FROM OLD.referred_by_code THEN
    RAISE EXCEPTION 'Protected profile fields can only be changed by the trusted server.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.claim_referral_code(p_referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(p_referral_code, ''), '[^A-Z0-9]', '', 'g'));
  v_referrer public.profiles%ROWTYPE;
  v_referred public.profiles%ROWTYPE;
  v_rules jsonb := '{}'::jsonb;
  v_referrer_reward numeric(12,2) := 0;
  v_referee_reward numeric(12,2) := 0;
  v_referral_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to claim an invite code.' USING ERRCODE = '42501';
  END IF;

  IF length(v_code) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('referral:' || v_uid::text, 0));

  SELECT profile.*
  INTO v_referred
  FROM public.profiles AS profile
  WHERE profile.id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile is not ready yet.' USING ERRCODE = 'P0002';
  END IF;

  SELECT profile.*
  INTO v_referrer
  FROM public.profiles AS profile
  WHERE profile.referral_code = v_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_referrer.id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral_blocked');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.referrals AS referral
    WHERE referral.referred_id = v_uid
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_claimed');
  END IF;

  SELECT COALESCE(setting.value, '{}'::jsonb)
  INTO v_rules
  FROM public.platform_settings AS setting
  WHERE setting.key = 'loyalty_referral';

  IF NOT COALESCE((v_rules->>'referral_enabled')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'referrals_disabled');
  END IF;

  v_referrer_reward := GREATEST(COALESCE((v_rules->>'referrer_reward')::numeric, 0), 0);
  v_referee_reward := GREATEST(COALESCE((v_rules->>'referee_discount')::numeric, 0), 0);

  INSERT INTO public.referrals (
    referrer_id,
    referred_id,
    referred_email,
    referred_phone,
    code,
    status,
    reward_amount,
    referrer_reward_amount,
    referee_reward_amount,
    metadata
  )
  VALUES (
    v_referrer.id,
    v_uid,
    v_referred.email,
    v_referred.phone,
    v_code,
    'pending',
    v_referrer_reward,
    v_referrer_reward,
    v_referee_reward,
    jsonb_build_object('claimed_at', now(), 'source', 'signup_referral')
  )
  RETURNING id INTO v_referral_id;

  UPDATE public.profiles
  SET acquisition_source = 'referral',
      referred_by_code = v_code,
      updated_at = now()
  WHERE id = v_uid;

  PERFORM public.log_activity(
    'admin_action'::public.audit_action,
    'referral',
    v_referral_id,
    jsonb_build_object('action', 'referral_claimed', 'referrer_id', v_referrer.id, 'referred_id', v_uid)
  );

  RETURN jsonb_build_object('ok', true, 'reason', 'claimed', 'referral_id', v_referral_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.kiyo_add_loyalty_points(
  p_customer_id uuid,
  p_points integer,
  p_reason text,
  p_order_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_customer_id IS NULL OR COALESCE(p_points, 0) <= 0 OR trim(COALESCE(p_reason, '')) = '' THEN
    RETURN;
  END IF;

  IF p_order_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.loyalty_transactions AS tx
    WHERE tx.customer_id = p_customer_id
      AND tx.order_id = p_order_id
      AND tx.reason = p_reason
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.loyalty_transactions (customer_id, points, reason, order_id)
  VALUES (p_customer_id, p_points, p_reason, p_order_id);

  INSERT INTO public.loyalty_points AS points (customer_id, points, lifetime_points)
  VALUES (p_customer_id, p_points, p_points)
  ON CONFLICT (customer_id) DO UPDATE SET
    points = points.points + EXCLUDED.points,
    lifetime_points = points.lifetime_points + EXCLUDED.lifetime_points,
    tier = CASE
      WHEN points.lifetime_points + EXCLUDED.lifetime_points >= 10000 THEN 'platinum'
      WHEN points.lifetime_points + EXCLUDED.lifetime_points >= 5000 THEN 'gold'
      WHEN points.lifetime_points + EXCLUDED.lifetime_points >= 2000 THEN 'silver'
      ELSE 'bronze'
    END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.award_referral_rewards_for_order(
  p_customer_id uuid,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referral public.referrals%ROWTYPE;
  v_rules jsonb := '{}'::jsonb;
  v_point_value numeric := 1;
  v_referrer_points integer := 0;
  v_referee_points integer := 0;
  v_delivered_count integer := 0;
BEGIN
  IF p_customer_id IS NULL OR p_order_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('referral-order:' || p_order_id::text, 0));

  SELECT count(*)
  INTO v_delivered_count
  FROM public.orders AS order_row
  WHERE order_row.customer_id = p_customer_id
    AND order_row.status::text = 'delivered';

  IF v_delivered_count <> 1 THEN
    RETURN;
  END IF;

  SELECT referral.*
  INTO v_referral
  FROM public.referrals AS referral
  WHERE referral.referred_id = p_customer_id
    AND referral.status = 'pending'
  ORDER BY referral.created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_referral.rewarded_at IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(setting.value, '{}'::jsonb)
  INTO v_rules
  FROM public.platform_settings AS setting
  WHERE setting.key = 'loyalty_referral';

  IF NOT COALESCE((v_rules->>'referral_enabled')::boolean, false) THEN
    UPDATE public.referrals
    SET status = 'completed',
        completed_at = COALESCE(completed_at, now()),
        first_order_id = p_order_id,
        metadata = metadata || jsonb_build_object('completed_without_reward', true)
    WHERE id = v_referral.id;
    RETURN;
  END IF;

  v_point_value := GREATEST(COALESCE((v_rules->>'point_value_dzd')::numeric, 1), 1);
  v_referrer_points := CEIL(GREATEST(COALESCE(v_referral.referrer_reward_amount, 0), 0) / v_point_value)::integer;
  v_referee_points := CEIL(GREATEST(COALESCE(v_referral.referee_reward_amount, 0), 0) / v_point_value)::integer;

  PERFORM public.kiyo_add_loyalty_points(v_referral.referrer_id, v_referrer_points, 'referral_reward', p_order_id);
  PERFORM public.kiyo_add_loyalty_points(p_customer_id, v_referee_points, 'referral_first_order_bonus', p_order_id);

  UPDATE public.referrals
  SET status = CASE WHEN v_referrer_points > 0 OR v_referee_points > 0 THEN 'rewarded' ELSE 'completed' END,
      completed_at = COALESCE(completed_at, now()),
      rewarded_at = CASE WHEN v_referrer_points > 0 OR v_referee_points > 0 THEN now() ELSE rewarded_at END,
      first_order_id = p_order_id,
      metadata = metadata || jsonb_build_object(
        'rewarded_by_order_id', p_order_id,
        'referrer_points', v_referrer_points,
        'referee_points', v_referee_points
      )
  WHERE id = v_referral.id;

  PERFORM public.log_activity(
    'admin_action'::public.audit_action,
    'referral',
    v_referral.id,
    jsonb_build_object(
      'action', 'referral_first_order_rewarded',
      'order_id', p_order_id,
      'referrer_id', v_referral.referrer_id,
      'referred_id', p_customer_id,
      'referrer_points', v_referrer_points,
      'referee_points', v_referee_points
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.award_referral_rewards_on_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status::text = 'delivered'
     AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    PERFORM public.award_referral_rewards_for_order(NEW.customer_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_referral_rewards_on_delivery ON public.orders;
CREATE TRIGGER trg_award_referral_rewards_on_delivery
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.award_referral_rewards_on_delivery();

REVOKE ALL ON FUNCTION public.kiyo_generate_referral_code(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_profile_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_referral_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kiyo_add_loyalty_points(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_referral_rewards_for_order(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_referral_rewards_on_delivery() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kiyo_generate_referral_code(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_profile_referral_code() TO service_role;
GRANT EXECUTE ON FUNCTION public.kiyo_add_loyalty_points(uuid, integer, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_referral_rewards_for_order(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.award_referral_rewards_on_delivery() TO service_role;

COMMIT;
