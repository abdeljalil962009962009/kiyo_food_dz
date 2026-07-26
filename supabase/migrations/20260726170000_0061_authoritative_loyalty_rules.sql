-- Kiyo Food 0061: make loyalty awards follow the owner-controlled rule.
-- Additive/idempotent hardening: no customer points or history are deleted.
BEGIN;

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'loyalty_referral',
  jsonb_build_object(
    'loyalty_enabled', false,
    'points_per_hundred', 1,
    'point_value_dzd', 1,
    'referral_enabled', false,
    'referrer_reward', 0,
    'referee_discount', 0,
    'min_order_value', 0
  ),
  'Authoritative loyalty and referral economics'
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_build_object(
      'loyalty_enabled',
        COALESCE(
          (public.platform_settings.value->>'loyalty_enabled')::boolean,
          false
        ),
      'points_per_hundred',
        COALESCE(
          (public.platform_settings.value->>'points_per_hundred')::numeric,
          NULLIF((public.platform_settings.value->>'points_per_dzd')::numeric, 0) * 100,
          1
        ),
      'point_value_dzd',
        COALESCE(
          (public.platform_settings.value->>'point_value_dzd')::numeric,
          NULLIF((public.platform_settings.value->>'points_redemption_rate')::numeric, 0),
          1
        ),
      'referral_enabled',
        COALESCE((public.platform_settings.value->>'referral_enabled')::boolean, false),
      'referrer_reward',
        COALESCE(
          (public.platform_settings.value->>'referrer_reward')::numeric,
          (public.platform_settings.value->>'referral_reward_amount')::numeric,
          0
        ),
      'referee_discount',
        COALESCE(
          (public.platform_settings.value->>'referee_discount')::numeric,
          (public.platform_settings.value->>'referred_customer_reward')::numeric,
          0
        ),
      'min_order_value',
        COALESCE((public.platform_settings.value->>'min_order_value')::numeric, 0)
    ),
    description = 'Authoritative loyalty and referral economics',
    updated_at = now();

CREATE OR REPLACE FUNCTION public.validate_loyalty_referral_setting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.key <> 'loyalty_referral' THEN
    RETURN NEW;
  END IF;

  IF COALESCE((NEW.value->>'points_per_hundred')::numeric, 0) < 0
    OR COALESCE((NEW.value->>'points_per_hundred')::numeric, 0) > 100
    OR COALESCE((NEW.value->>'point_value_dzd')::numeric, 0) < 0
    OR COALESCE((NEW.value->>'referrer_reward')::numeric, 0) < 0
    OR COALESCE((NEW.value->>'referee_discount')::numeric, 0) < 0
    OR COALESCE((NEW.value->>'min_order_value')::numeric, 0) < 0 THEN
    RAISE EXCEPTION 'Loyalty and referral values must be within their permitted range.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_loyalty_referral_setting ON public.platform_settings;
CREATE TRIGGER trg_validate_loyalty_referral_setting
  BEFORE INSERT OR UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_loyalty_referral_setting();

CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  p_customer_id uuid,
  p_order_id uuid,
  p_order_total numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_features jsonb := '{}'::jsonb;
  v_rules jsonb := '{}'::jsonb;
  v_order_total numeric;
  v_points_per_hundred numeric;
  v_points integer;
BEGIN
  IF p_customer_id IS NULL OR p_order_id IS NULL THEN
    RETURN;
  END IF;

  -- Serialize awards per order so retries and concurrent trigger execution
  -- cannot create duplicate loyalty transactions.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_order_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.loyalty_transactions lt
    WHERE lt.order_id = p_order_id
      AND lt.reason = 'order_completion'
  ) THEN
    RETURN;
  END IF;

  SELECT o.total::numeric
  INTO v_order_total
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.customer_id = p_customer_id
    AND o.status::text = 'delivered';

  IF v_order_total IS NULL THEN
    RAISE EXCEPTION 'Loyalty points require the matching delivered order.'
      USING ERRCODE = '22023';
  END IF;

  SELECT ps.value INTO v_features
  FROM public.platform_settings ps
  WHERE ps.key = 'features';

  SELECT ps.value INTO v_rules
  FROM public.platform_settings ps
  WHERE ps.key = 'loyalty_referral';

  IF NOT COALESCE((v_features->>'loyalty')::boolean, false)
    OR NOT COALESCE((v_rules->>'loyalty_enabled')::boolean, false) THEN
    RETURN;
  END IF;

  v_points_per_hundred := COALESCE(
    (v_rules->>'points_per_hundred')::numeric,
    NULLIF((v_rules->>'points_per_dzd')::numeric, 0) * 100,
    1
  );
  v_points := pg_catalog.floor((v_order_total / 100) * v_points_per_hundred)::integer;

  IF v_points <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.loyalty_transactions (customer_id, points, reason, order_id)
  VALUES (p_customer_id, v_points, 'order_completion', p_order_id);

  INSERT INTO public.loyalty_points AS lp (customer_id, points, lifetime_points)
  VALUES (p_customer_id, v_points, v_points)
  ON CONFLICT (customer_id) DO UPDATE SET
    points = lp.points + EXCLUDED.points,
    lifetime_points = lp.lifetime_points + EXCLUDED.lifetime_points,
    tier = CASE
      WHEN lp.lifetime_points + EXCLUDED.lifetime_points >= 10000 THEN 'platinum'
      WHEN lp.lifetime_points + EXCLUDED.lifetime_points >= 5000 THEN 'gold'
      WHEN lp.lifetime_points + EXCLUDED.lifetime_points >= 2000 THEN 'silver'
      ELSE 'bronze'
    END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_recent_orders_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status::text = 'delivered'
    AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    INSERT INTO public.recent_orders_summary (
      customer_id,
      restaurant_id,
      last_order_at,
      order_count
    )
    VALUES (NEW.customer_id, NEW.restaurant_id, now(), 1)
    ON CONFLICT (customer_id, restaurant_id) DO UPDATE SET
      last_order_at = now(),
      order_count = public.recent_orders_summary.order_count + 1;

    PERFORM public.award_loyalty_points(NEW.customer_id, NEW.id, NEW.total::numeric);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_loyalty_referral_setting() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_loyalty_points(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_recent_orders_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_loyalty_referral_setting() TO service_role;
GRANT EXECUTE ON FUNCTION public.award_loyalty_points(uuid, uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_recent_orders_summary() TO service_role;

COMMIT;
