-- ============================================================================
-- KIYO FOOD Phase 6 — Enterprise admin: platform settings, settlements,
-- feature flags, analytics RPCs, user management, restaurant verification
-- ============================================================================

-- ---------- 1. platform_settings (singleton key-value store) ----------
CREATE TABLE IF NOT EXISTS platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by  uuid REFERENCES profiles(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('delivery', '{
    "price_per_km": 25,
    "min_fee": 50,
    "max_fee": 500,
    "free_delivery_threshold": 1500,
    "default_max_delivery_km": 10
  }', 'Delivery pricing rules (DZD/km, min/max fees, free-delivery threshold)'),
  ('commission', '{
    "default_rate": 0.07,
    "service_fee_rate": 0.01,
    "overrides": {}
  }', 'Commission + service fee configuration with per-restaurant overrides'),
  ('settlement', '{
    "period": "monthly",
    "due_day": 15,
    "grace_days": 7,
    "penalty_rate": 0.02
  }', 'Settlement cycle: monthly close, due day, grace period, penalty rate'),
  ('operational', '{
    "maintenance_mode": false,
    "announcement_banner": "",
    "registration_open": true,
    "verification_required": true
  }', 'Operational rules: maintenance mode, announcements, registration, verification'),
  ('features', '{
    "reviews": true,
    "gps_delivery": true,
    "saved_addresses": true,
    "referrals": false,
    "loyalty_points": false,
    "coupons": true,
    "featured_restaurants": true
  }', 'Feature flags — enable/disable any feature instantly without code changes')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settings_select ON platform_settings;
DROP POLICY IF EXISTS settings_update_admin ON platform_settings;
CREATE POLICY settings_select ON platform_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_update_admin ON platform_settings
  FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ---------- 2. settlements (monthly financial close per restaurant) ----------
CREATE TABLE IF NOT EXISTS settlements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  gross_sales     numeric(12,2) NOT NULL DEFAULT 0,
  platform_commission numeric(12,2) NOT NULL DEFAULT 0,
  service_fees    numeric(12,2) NOT NULL DEFAULT 0,
  restaurant_payout   numeric(12,2) NOT NULL DEFAULT 0,
  amount_owed     numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid     numeric(12,2) NOT NULL DEFAULT 0,
  balance         numeric(12,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','disputed','partially_paid')),
  due_date        date,
  settled_at      timestamptz,
  notes           text,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, period_start)
);
CREATE INDEX IF NOT EXISTS idx_settlements_restaurant ON settlements (restaurant_id, period_start);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements (status);

ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settlements_select ON settlements;
DROP POLICY IF EXISTS settlements_update_admin ON settlements;
CREATE POLICY settlements_select ON settlements
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
    OR public.is_super_admin()
  );
CREATE POLICY settlements_update_admin ON settlements
  FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ---------- 3. Restaurant verification + featured columns ----------
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz;

-- ---------- 4. User management: suspended/banned support ----------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_ip inet;

-- ---------- 5. support_tickets ----------
CREATE TABLE IF NOT EXISTS support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject     text NOT NULL CHECK (length(subject) >= 3),
  body        text NOT NULL CHECK (length(body) >= 10),
  category    text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general','bug','abuse','complaint','billing','other')),
  status      text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','resolved','closed')),
  priority    text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to uuid REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets (status, created_at);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tickets_select ON support_tickets;
DROP POLICY IF EXISTS tickets_insert_own ON support_tickets;
DROP POLICY IF EXISTS tickets_update_admin ON support_tickets;
CREATE POLICY tickets_select ON support_tickets
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.is_super_admin());
CREATE POLICY tickets_insert_own ON support_tickets
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY tickets_update_admin ON support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ---------- 6. RPC: get_platform_analytics ----------
CREATE OR REPLACE FUNCTION public.get_platform_analytics()
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
    'revenue', jsonb_build_object(
      'today', COALESCE((SELECT sum(total) FROM orders WHERE status != 'cancelled' AND created_at >= date_trunc('day', now())), 0),
      'this_week', COALESCE((SELECT sum(total) FROM orders WHERE status != 'cancelled' AND created_at >= date_trunc('week', now())), 0),
      'this_month', COALESCE((SELECT sum(total) FROM orders WHERE status != 'cancelled' AND created_at >= date_trunc('month', now())), 0),
      'this_year', COALESCE((SELECT sum(total) FROM orders WHERE status != 'cancelled' AND created_at >= date_trunc('year', now())), 0),
      'all_time', COALESCE((SELECT sum(total) FROM orders WHERE status != 'cancelled'), 0)
    ),
    'commission', jsonb_build_object(
      'today', COALESCE((SELECT sum(platform_commission) FROM financial_ledger WHERE created_at >= date_trunc('day', now())), 0),
      'this_month', COALESCE((SELECT sum(platform_commission) FROM financial_ledger WHERE created_at >= date_trunc('month', now())), 0),
      'all_time', COALESCE((SELECT sum(platform_commission) FROM financial_ledger), 0)
    ),
    'orders', jsonb_build_object(
      'total', (SELECT count(*) FROM orders),
      'today', (SELECT count(*) FROM orders WHERE created_at >= date_trunc('day', now())),
      'pending', (SELECT count(*) FROM orders WHERE status IN ('pending','accepted','preparing','out_for_delivery')),
      'cancelled', (SELECT count(*) FROM orders WHERE status = 'cancelled'),
      'delivered', (SELECT count(*) FROM orders WHERE status = 'delivered')
    ),
    'restaurants', jsonb_build_object(
      'total', (SELECT count(*) FROM restaurants),
      'published', (SELECT count(*) FROM restaurants WHERE status = 'published'),
      'pending', (SELECT count(*) FROM restaurants WHERE status = 'pending_approval'),
      'suspended', (SELECT count(*) FROM restaurants WHERE status = 'suspended'),
      'verified', (SELECT count(*) FROM restaurants WHERE is_verified)
    ),
    'users', jsonb_build_object(
      'total', (SELECT count(*) FROM profiles),
      'customers', (SELECT count(*) FROM profiles WHERE role = 'customer'),
      'owners', (SELECT count(*) FROM profiles WHERE role = 'restaurant_owner'),
      'admins', (SELECT count(*) FROM profiles WHERE role = 'super_admin'),
      'suspended', (SELECT count(*) FROM profiles WHERE is_suspended)
    ),
    'settlements', jsonb_build_object(
      'pending', COALESCE((SELECT sum(balance) FROM settlements WHERE status IN ('pending','overdue','partially_paid')), 0),
      'overdue', COALESCE((SELECT sum(balance) FROM settlements WHERE status = 'overdue'), 0),
      'paid_this_year', COALESCE((SELECT sum(amount_paid) FROM settlements WHERE status = 'paid' AND settled_at >= date_trunc('year', now())), 0)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_platform_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_analytics() TO authenticated;

-- ---------- 7. RPC: get_restaurant_financials ----------
CREATE OR REPLACE FUNCTION public.get_restaurant_financials(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_is_owner boolean;
BEGIN
  SELECT (owner_id = auth.uid()) INTO v_is_owner FROM restaurants WHERE id = p_restaurant_id;
  IF NOT v_is_owner AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: not restaurant owner' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'revenue', jsonb_build_object(
      'today', COALESCE((SELECT sum(total) FROM orders WHERE restaurant_id = p_restaurant_id AND status != 'cancelled' AND created_at >= date_trunc('day', now())), 0),
      'this_week', COALESCE((SELECT sum(total) FROM orders WHERE restaurant_id = p_restaurant_id AND status != 'cancelled' AND created_at >= date_trunc('week', now())), 0),
      'this_month', COALESCE((SELECT sum(total) FROM orders WHERE restaurant_id = p_restaurant_id AND status != 'cancelled' AND created_at >= date_trunc('month', now())), 0),
      'this_year', COALESCE((SELECT sum(total) FROM orders WHERE restaurant_id = p_restaurant_id AND status != 'cancelled' AND created_at >= date_trunc('year', now())), 0),
      'all_time', COALESCE((SELECT sum(total) FROM orders WHERE restaurant_id = p_restaurant_id AND status != 'cancelled'), 0)
    ),
    'commission_owed', COALESCE((
      SELECT sum(platform_commission) FROM financial_ledger
      WHERE restaurant_id = p_restaurant_id AND settlement_status = 'pending'
    ), 0),
    'payout_pending', COALESCE((
      SELECT sum(restaurant_payout) FROM financial_ledger
      WHERE restaurant_id = p_restaurant_id AND settlement_status = 'pending'
    ), 0),
    'orders_count', (SELECT count(*) FROM orders WHERE restaurant_id = p_restaurant_id),
    'delivered_count', (SELECT count(*) FROM orders WHERE restaurant_id = p_restaurant_id AND status = 'delivered'),
    'avg_order_value', COALESCE((
      SELECT avg(total) FROM orders
      WHERE restaurant_id = p_restaurant_id AND status != 'cancelled'
    ), 0),
    'settlements', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'period_start', period_start, 'period_end', period_end,
        'gross_sales', gross_sales, 'commission', platform_commission,
        'payout', restaurant_payout, 'amount_owed', amount_owed,
        'amount_paid', amount_paid, 'balance', balance, 'status', status,
        'due_date', due_date, 'settled_at', settled_at
      ) ORDER BY period_start DESC)
      FROM settlements WHERE restaurant_id = p_restaurant_id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_restaurant_financials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_financials(uuid) TO authenticated;

-- ---------- 8. RPC: generate_monthly_settlement ----------
CREATE OR REPLACE FUNCTION public.generate_monthly_settlement(
  p_restaurant_id uuid,
  p_period_start date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_end date;
  v_gross numeric(12,2);
  v_commission numeric(12,2);
  v_service numeric(12,2);
  v_payout numeric(12,2);
  v_owed numeric(12,2);
  v_due_date date;
  v_settlement_id uuid;
  v_due_day int;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  v_period_end := (date_trunc('month', p_period_start) + interval '1 month' - interval '1 day')::date;

  SELECT id INTO v_settlement_id FROM settlements
    WHERE restaurant_id = p_restaurant_id AND period_start = p_period_start;
  IF v_settlement_id IS NOT NULL THEN
    RAISE EXCEPTION 'settlement_already_exists' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(sum(order_total), 0),
    COALESCE(sum(platform_commission), 0),
    COALESCE(sum(service_fee), 0),
    COALESCE(sum(restaurant_payout), 0)
  INTO v_gross, v_commission, v_service, v_payout
  FROM financial_ledger
  WHERE restaurant_id = p_restaurant_id
    AND created_at >= p_period_start
    AND created_at < v_period_end + interval '1 day';

  v_owed := v_commission;

  SELECT (value->>'due_day')::int INTO v_due_day FROM platform_settings WHERE key = 'settlement';
  v_due_date := (date_trunc('month', p_period_start) + interval '1 month' +
    (COALESCE(v_due_day, 15) - 1) * interval '1 day')::date;

  INSERT INTO settlements (
    restaurant_id, period_start, period_end,
    gross_sales, platform_commission, service_fees, restaurant_payout,
    amount_owed, balance, status, due_date, created_by
  ) VALUES (
    p_restaurant_id, p_period_start, v_period_end,
    v_gross, v_commission, v_service, v_payout,
    v_owed, v_owed, 'pending', v_due_date, auth.uid()
  )
  RETURNING id INTO v_settlement_id;

  PERFORM public.log_activity(
    'settlement_generated',
    'settlement',
    v_settlement_id,
    jsonb_build_object('restaurant_id', p_restaurant_id, 'period', p_period_start, 'amount_owed', v_owed)
  );

  RETURN jsonb_build_object('settlement_id', v_settlement_id, 'amount_owed', v_owed);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generate_monthly_settlement(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_monthly_settlement(uuid, date) TO authenticated;

-- ---------- 9. RPC: mark_settlement_paid ----------
CREATE OR REPLACE FUNCTION public.mark_settlement_paid(
  p_settlement_id uuid,
  p_amount numeric DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settlement settlements%ROWTYPE;
  v_new_paid numeric(12,2);
  v_new_balance numeric(12,2);
  v_new_status text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_settlement FROM settlements WHERE id = p_settlement_id;
  IF v_settlement.id IS NULL THEN
    RAISE EXCEPTION 'settlement_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_new_paid := v_settlement.amount_paid + COALESCE(p_amount, v_settlement.balance);
  v_new_balance := v_settlement.amount_owed - v_new_paid;

  IF v_new_balance <= 0 THEN
    v_new_status := 'paid';
    v_new_balance := 0;
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE settlements SET
    amount_paid = v_new_paid,
    balance = v_new_balance,
    status = v_new_status,
    settled_at = CASE WHEN v_new_status = 'paid' THEN now() ELSE settled_at END,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_settlement_id;

  PERFORM public.log_activity(
    'settlement_marked_paid',
    'settlement',
    p_settlement_id,
    jsonb_build_object('amount', COALESCE(p_amount, v_settlement.balance), 'status', v_new_status)
  );

  RETURN jsonb_build_object('status', v_new_status, 'balance', v_new_balance);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_settlement_paid(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_settlement_paid(uuid, numeric, text) TO authenticated;

-- ---------- 10. RPC: set_user_suspended ----------
CREATE OR REPLACE FUNCTION public.set_user_suspended(
  p_user_id uuid,
  p_suspended boolean,
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
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_suspend_self' USING ERRCODE = 'P0001';
  END IF;

  UPDATE profiles SET
    is_suspended = p_suspended,
    suspended_reason = CASE WHEN p_suspended THEN p_reason ELSE NULL END,
    suspended_at = CASE WHEN p_suspended THEN now() ELSE NULL END
  WHERE id = p_user_id;

  PERFORM public.log_activity(
    CASE WHEN p_suspended THEN 'user_suspended' ELSE 'user_restored' END,
    'user',
    p_user_id,
    jsonb_build_object('reason', p_reason)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean, text) TO authenticated;

-- ---------- 11. RPC: update_restaurant_admin ----------
CREATE OR REPLACE FUNCTION public.update_restaurant_admin(
  p_restaurant_id uuid,
  p_status text DEFAULT NULL,
  p_is_verified boolean DEFAULT NULL,
  p_is_featured boolean DEFAULT NULL
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

  UPDATE restaurants SET
    status = COALESCE(p_status, status),
    is_verified = COALESCE(p_is_verified, is_verified),
    is_featured = COALESCE(p_is_featured, is_featured),
    featured_until = CASE WHEN COALESCE(p_is_featured, is_featured) THEN now() + interval '30 days' ELSE NULL END
  WHERE id = p_restaurant_id;

  PERFORM public.log_activity(
    'restaurant_admin_update',
    'restaurant',
    p_restaurant_id,
    jsonb_build_object('status', p_status, 'verified', p_is_verified, 'featured', p_is_featured)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_restaurant_admin(uuid, text, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_restaurant_admin(uuid, text, boolean, boolean) TO authenticated;

-- ---------- 12. RPC: update_platform_setting ----------
CREATE OR REPLACE FUNCTION public.update_platform_setting(
  p_key text,
  p_value jsonb
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

  INSERT INTO platform_settings (key, value, updated_by, updated_at)
  VALUES (p_key, p_value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  PERFORM public.log_activity(
    'platform_setting_updated',
    'platform_setting',
    NULL,
    jsonb_build_object('key', p_key)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_platform_setting(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_setting(text, jsonb) TO authenticated;
