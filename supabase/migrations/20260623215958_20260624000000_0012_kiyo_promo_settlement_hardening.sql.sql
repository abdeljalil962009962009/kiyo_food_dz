-- ============================================================================
-- KIYO FOOD Phase 7 Pre-Production — promo codes, referrals, settlement UI support,
-- force-close orders, device tracking
-- ============================================================================

-- ---------- 1. promo_codes ----------
CREATE TABLE IF NOT EXISTS promo_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE CHECK (length(code) >= 3 AND code = upper(code)),
  description     text,
  discount_type   text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value  numeric(12,2) NOT NULL CHECK (discount_value > 0),
  min_order_amount numeric(12,2) NOT NULL DEFAULT 0,
  max_discount    numeric(12,2),
  usage_limit     int,
  used_count      int NOT NULL DEFAULT 0,
  valid_from      timestamptz NOT NULL DEFAULT now(),
  valid_until     timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes (code) WHERE is_active = true;

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promo_select_active ON promo_codes;
DROP POLICY IF EXISTS promo_select_admin ON promo_codes;
DROP POLICY IF EXISTS promo_insert_admin ON promo_codes;
DROP POLICY IF EXISTS promo_update_admin ON promo_codes;
DROP POLICY IF EXISTS promo_delete_admin ON promo_codes;
CREATE POLICY promo_select_active ON promo_codes
  FOR SELECT TO authenticated
  USING (is_active = true AND valid_from <= now()
    AND (valid_until IS NULL OR valid_until >= now())
    AND (usage_limit IS NULL OR used_count < usage_limit));
CREATE POLICY promo_select_admin ON promo_codes
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
CREATE POLICY promo_insert_admin ON promo_codes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY promo_update_admin ON promo_codes
  FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY promo_delete_admin ON promo_codes
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ---------- 2. referrals ----------
CREATE TABLE IF NOT EXISTS referrals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_email  text,
  referred_id     uuid REFERENCES profiles(id),
  code            text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','rewarded')),
  reward_amount   numeric(12,2) NOT NULL DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS referrals_select_own ON referrals;
DROP POLICY IF EXISTS referrals_insert_own ON referrals;
CREATE POLICY referrals_select_own ON referrals
  FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR public.is_super_admin());
CREATE POLICY referrals_insert_own ON referrals
  FOR INSERT TO authenticated WITH CHECK (referrer_id = auth.uid());

-- ---------- 3. Add promo_code to orders ----------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES promo_codes(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

-- ---------- 4. RPC: validate_promo_code ----------
CREATE OR REPLACE FUNCTION public.validate_promo_code(
  p_code text,
  p_order_total numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_promo promo_codes%ROWTYPE;
  v_discount numeric(12,2);
BEGIN
  SELECT * INTO v_promo FROM promo_codes
    WHERE code = upper(p_code) AND is_active = true
    AND valid_from <= now()
    AND (valid_until IS NULL OR valid_until >= now())
    AND (usage_limit IS NULL OR used_count < usage_limit);

  IF v_promo.id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_code' USING ERRCODE = 'P0001';
  END IF;

  IF p_order_total < v_promo.min_order_amount THEN
    RAISE EXCEPTION 'minimum_order_not_met' USING ERRCODE = 'P0001';
  END IF;

  IF v_promo.discount_type = 'percentage' THEN
    v_discount := ROUND(p_order_total * v_promo.discount_value / 100, 2);
    IF v_promo.max_discount IS NOT NULL AND v_discount > v_promo.max_discount THEN
      v_discount := v_promo.max_discount;
    END IF;
  ELSE
    v_discount := v_promo.discount_value;
  END IF;

  RETURN jsonb_build_object(
    'promo_id', v_promo.id,
    'discount', v_discount,
    'discount_type', v_promo.discount_type,
    'description', v_promo.description
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_promo_code(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, numeric) TO authenticated;

-- ---------- 5. RPC: force_close_order ----------
CREATE OR REPLACE FUNCTION public.force_close_order(
  p_order_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  IF p_new_status NOT IN ('cancelled','delivered','failed_delivery','refunded') THEN
    RAISE EXCEPTION 'invalid_force_close_status' USING ERRCODE = '22023';
  END IF;

  UPDATE orders SET status = p_new_status::order_status WHERE id = p_order_id;

  PERFORM public.log_activity(
    'force_close_order',
    'order',
    p_order_id,
    jsonb_build_object('new_status', p_new_status, 'reason', p_reason, 'admin', auth.uid())
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.force_close_order(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.force_close_order(uuid, text, text) TO authenticated;

-- ---------- 6. RPC: get_settlement_overview ----------
CREATE OR REPLACE FUNCTION public.get_settlement_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_owed', COALESCE((
      SELECT sum(balance) FROM settlements WHERE status IN ('pending','overdue','partially_paid')
    ), 0),
    'total_paid', COALESCE((
      SELECT sum(amount_paid) FROM settlements WHERE status = 'paid'
    ), 0),
    'overdue_count', (SELECT count(*) FROM settlements WHERE status = 'overdue'),
    'pending_count', (SELECT count(*) FROM settlements WHERE status = 'pending'),
    'paid_count', (SELECT count(*) FROM settlements WHERE status = 'paid'),
    'recent', COALESCE((
      SELECT jsonb_agg(t) FROM (
        SELECT jsonb_build_object(
          'id', s.id, 'restaurant_id', s.restaurant_id,
          'restaurant_name', r.name,
          'period_start', s.period_start, 'period_end', s.period_end,
          'gross_sales', s.gross_sales, 'commission', s.platform_commission,
          'payout', s.restaurant_payout, 'amount_owed', s.amount_owed,
          'amount_paid', s.amount_paid, 'balance', s.balance,
          'status', s.status, 'due_date', s.due_date, 'settled_at', s.settled_at
        ) AS t
        FROM settlements s
        JOIN restaurants r ON r.id = s.restaurant_id
        ORDER BY s.period_start DESC
        LIMIT 20
      ) sub
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_settlement_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_settlement_overview() TO authenticated;

-- ---------- 7. RPC: get_top_restaurants ----------
CREATE OR REPLACE FUNCTION public.get_top_restaurants(p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_agg(t) INTO v_result FROM (
    SELECT jsonb_build_object(
      'id', r.id, 'name', r.name, 'image_url', r.image_url,
      'revenue', COALESCE(rev.total, 0), 'orders', COALESCE(rev.count, 0),
      'commission', COALESCE(rev.commission, 0), 'rating', r.rating
    ) AS t
    FROM restaurants r
    LEFT JOIN (
      SELECT restaurant_id, sum(total) as total, count(*) as count, sum(service_fee) as commission
      FROM orders WHERE status != 'cancelled'
      GROUP BY restaurant_id
    ) rev ON rev.restaurant_id = r.id
    WHERE r.status = 'published'
    ORDER BY COALESCE(rev.total, 0) DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_top_restaurants(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_restaurants(int) TO authenticated;

-- ---------- 8. Device tracking ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS device_info jsonb DEFAULT '{}'::jsonb;
