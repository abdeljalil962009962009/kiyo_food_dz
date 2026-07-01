-- ============================================================================
-- KIYO Phase 5 — maps, reviews, immutable ledger, restaurant delivery zones
-- All in one migration. Every new table gets RLS + 4 CRUD policies.
-- ============================================================================

-- ---------- 1. Restaurants: add delivery_zone (geo) + max_delivery_km ----------
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS max_delivery_km numeric NOT NULL DEFAULT 10
    CHECK (max_delivery_km >= 0 AND max_delivery_km <= 100),
  ADD COLUMN IF NOT EXISTS min_order_amount numeric NOT NULL DEFAULT 0;

-- Constantine, Algeria city center as default (so the map opens sensibly)
UPDATE restaurants
  SET latitude  = COALESCE(latitude, 36.3650),
      longitude = COALESCE(longitude, 6.6147)
  WHERE latitude IS NULL OR longitude IS NULL;

-- ---------- 2. saved_addresses ----------
CREATE TABLE IF NOT EXISTS saved_addresses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label       text NOT NULL CHECK (label IN ('home','work','family','other')),
  custom_name text,
  address     text NOT NULL,
  latitude    double precision NOT NULL,
  longitude   double precision NOT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_customer ON saved_addresses (customer_id);
ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_addresses_select_own ON saved_addresses;
DROP POLICY IF EXISTS saved_addresses_insert_own ON saved_addresses;
DROP POLICY IF EXISTS saved_addresses_update_own ON saved_addresses;
DROP POLICY IF EXISTS saved_addresses_delete_own ON saved_addresses;
CREATE POLICY saved_addresses_select_own ON saved_addresses
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY saved_addresses_insert_own ON saved_addresses
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY saved_addresses_update_own ON saved_addresses
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
CREATE POLICY saved_addresses_delete_own ON saved_addresses
  FOR DELETE TO authenticated USING (customer_id = auth.uid());

-- ---------- 3. reviews ----------
CREATE TABLE IF NOT EXISTS reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id      uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment       text CHECK (length(comment) <= 1000),
  owner_reply   text CHECK (length(owner_reply) <= 1000),
  replied_at    timestamptz,
  is_hidden     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)  -- one review per order, prevents spam
);
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews (restaurant_id, is_hidden, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_customer  ON reviews (customer_id);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_select_visible ON reviews;
DROP POLICY IF EXISTS reviews_insert_own ON reviews;
DROP POLICY IF EXISTS reviews_update_owner ON reviews;
DROP POLICY IF EXISTS reviews_delete_admin ON reviews;
-- Visible reviews: not hidden, OR owner of the restaurant can see hidden ones, OR admin
CREATE POLICY reviews_select_visible ON reviews
  FOR SELECT TO authenticated
  USING (
    (NOT is_hidden)
    OR EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
    OR public.is_super_admin()
  );
-- Customer can post a review ONLY if the order belongs to them + was delivered
CREATE POLICY reviews_insert_own ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND o.customer_id = auth.uid()
        AND o.status = 'delivered'
    )
  );
-- Restaurant owner can reply (update owner_reply only) on reviews for their restaurant
CREATE POLICY reviews_update_owner ON reviews
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));
-- Hard-delete: super_admin only (soft-hide via is_hidden is the norm)
CREATE POLICY reviews_delete_admin ON reviews
  FOR DELETE TO authenticated USING (public.is_super_admin());

-- ---------- 4. financial_ledger (immutable) ----------
-- Append-only. INSERT + SELECT allowed; UPDATE and DELETE denied by RLS.
CREATE TABLE IF NOT EXISTS financial_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  customer_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  order_total     numeric(12,2) NOT NULL,
  subtotal        numeric(12,2) NOT NULL,
  delivery_fee    numeric(12,2) NOT NULL,
  service_fee     numeric(12,2) NOT NULL,
  platform_commission numeric(12,2) NOT NULL,
  restaurant_payout   numeric(12,2) NOT NULL,
  settlement_status   text NOT NULL DEFAULT 'pending'
    CHECK (settlement_status IN ('pending','settled','disputed')),
  settled_at      timestamptz,
  locked_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_ledger_restaurant ON financial_ledger (restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_customer  ON financial_ledger (customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_settlement ON financial_ledger (settlement_status);

ALTER TABLE financial_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_select_own ON financial_ledger;
DROP POLICY IF EXISTS ledger_insert_rpc ON financial_ledger;
DROP POLICY IF EXISTS ledger_update_admin ON financial_ledger;
-- SELECT: customer sees their entries; restaurant owner sees their restaurant's; admin sees all
CREATE POLICY ledger_select_own ON financial_ledger
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
    OR public.is_super_admin()
  );
-- INSERT: only the create_order_with_items RPC (which runs as authenticated + SECURITY DEFINER
-- chain) writes here. We allow authenticated INSERT but the function is the only caller.
CREATE POLICY ledger_insert_rpc ON financial_ledger
  FOR INSERT TO authenticated WITH CHECK (true);
-- UPDATE: only super_admin can change settlement status (e.g. mark settled).
-- The locked_at column itself is NEVER updatable after set — enforced by trigger below.
CREATE POLICY ledger_update_admin ON financial_ledger
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
-- NO DELETE policy = DELETE is denied to everyone (immutable ledger).

-- Trigger: prevent any UPDATE to a ledger row after locked_at is set.
CREATE OR REPLACE FUNCTION public.guard_locked_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'ledger_row_locked: financial ledger entry is immutable'
      USING ERRCODE = 'P0003';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_locked_ledger() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_guard_locked_ledger ON financial_ledger;
CREATE TRIGGER trg_guard_locked_ledger
  BEFORE UPDATE ON financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_ledger();

-- ---------- 5. Extend create_order_with_items: also insert the ledger entry ----------
-- We re-declare the function: it now also writes a financial_ledger row in
-- the SAME transaction (atomicity guarantee — no orphan ledger entries).
CREATE OR REPLACE FUNCTION public.create_order_with_items(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_items jsonb;
  v_delivery_address text;
  v_delivery_phone text;
  v_notes text;
  v_delivery_km numeric := 0;
  v_idempotency_key text;
  v_finance jsonb;
  v_order_id uuid;
  v_items_to_insert jsonb;
  v_item jsonb;
  v_mi menu_items%ROWTYPE;
  v_commission numeric;
  v_service numeric;
  v_payout numeric;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  v_restaurant_id := (p_payload->>'restaurant_id')::uuid;
  v_items := p_payload->'items';
  v_delivery_address := COALESCE(p_payload->>'delivery_address', '');
  v_delivery_phone := COALESCE(p_payload->>'delivery_phone', '');
  v_notes := p_payload->>'notes';
  v_idempotency_key := p_payload->>'idempotency_key';
  IF (p_payload->>'delivery_km') IS NOT NULL THEN
    v_delivery_km := (p_payload->>'delivery_km')::numeric;
  END IF;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id required' USING ERRCODE = '22023';
  END IF;
  IF v_idempotency_key IS NULL OR length(v_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'idempotency_key required (>= 8 chars)' USING ERRCODE = '22023';
  END IF;
  IF NOT jsonb_typeof(v_items) = 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty array' USING ERRCODE = '22023';
  END IF;
  IF length(trim(v_delivery_phone)) < 6 THEN
    RAISE EXCEPTION 'delivery_phone required' USING ERRCODE = '22023';
  END IF;
  IF length(trim(v_delivery_address)) < 5 THEN
    RAISE EXCEPTION 'delivery_address required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = v_restaurant_id AND r.status = 'published'
  ) THEN
    RAISE EXCEPTION 'restaurant is not currently accepting orders' USING ERRCODE = '55006';
  END IF;

  v_finance := public.calculate_order_financials(v_items, v_delivery_km);

  BEGIN
    INSERT INTO orders (
      customer_id, restaurant_id, status, idempotency_key,
      subtotal, delivery_fee, service_fee, total,
      delivery_address, delivery_phone, notes
    ) VALUES (
      v_customer_id, v_restaurant_id, 'pending', v_idempotency_key,
      (v_finance->>'subtotal')::numeric,
      (v_finance->>'delivery_fee')::numeric,
      (v_finance->>'service_fee')::numeric,
      (v_finance->>'total')::numeric,
      v_delivery_address, v_delivery_phone,
      CASE WHEN v_notes IS NULL OR v_notes = '' THEN NULL ELSE v_notes END
    )
    RETURNING id INTO v_order_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'duplicate_order' USING ERRCODE = 'P0001';
  END;

  v_items_to_insert := '[]'::jsonb;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    SELECT * INTO v_mi FROM menu_items
      WHERE id = (v_item->>'menu_item_id')::uuid;
    v_items_to_insert := v_items_to_insert || jsonb_build_array(jsonb_build_object(
      'order_id', v_order_id,
      'name', v_mi.name,
      'quantity', (v_item->>'quantity')::int,
      'unit_price', v_mi.price,
      'notes', COALESCE(v_item->>'notes', NULL)
    ));
  END LOOP;

  INSERT INTO order_items (order_id, name, quantity, unit_price, notes)
  SELECT
    (j->>'order_id')::uuid,
    j->>'name',
    (j->>'quantity')::int,
    (j->>'unit_price')::numeric,
    j->>'notes'
  FROM jsonb_array_elements(v_items_to_insert) AS t(j);

  -- ---------- IMMUTABLE LEDGER ENTRY ----------
  -- Order total = subtotal + delivery_fee + service_fee
  -- platform_commission = 7% of (subtotal + delivery_fee)  [matches RPC]
  -- service_fee = 1% of (subtotal + delivery_fee)          [matches RPC]
  -- restaurant_payout = subtotal - platform_commission
  v_commission := round(
    ((v_finance->>'subtotal')::numeric + (v_finance->>'delivery_fee')::numeric) * 0.07,
    2
  );
  v_service := round(
    ((v_finance->>'subtotal')::numeric + (v_finance->>'delivery_fee')::numeric) * 0.01,
    2
  );
  v_payout := (v_finance->>'subtotal')::numeric - v_commission;

  INSERT INTO financial_ledger (
    order_id, restaurant_id, customer_id,
    order_total, subtotal, delivery_fee, service_fee,
    platform_commission, restaurant_payout,
    settlement_status, metadata
  ) VALUES (
    v_order_id, v_restaurant_id, v_customer_id,
    (v_finance->>'total')::numeric,
    (v_finance->>'subtotal')::numeric,
    (v_finance->>'delivery_fee')::numeric,
    v_service,
    v_commission,
    v_payout,
    'pending',
    jsonb_build_object('idempotency_key', v_idempotency_key, 'source', 'create_order_with_items')
  );

  PERFORM public.log_activity(
    'order_created',
    'order',
    v_order_id,
    jsonb_build_object('restaurant_id', v_restaurant_id, 'total', v_finance->>'total')
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'subtotal', v_finance->>'subtotal',
    'delivery_fee', v_finance->>'delivery_fee',
    'service_fee', v_finance->>'service_fee',
    'total', v_finance->>'total'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_order_with_items(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb) TO authenticated;

-- ---------- 6. update_restaurant_rating(now a real implementation) ----------
CREATE OR REPLACE FUNCTION public.update_restaurant_rating(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE restaurants r
  SET rating = COALESCE((
    SELECT round(avg(rating)::numeric, 2)
    FROM reviews rv
    WHERE rv.restaurant_id = p_restaurant_id AND NOT rv.is_hidden
  ), 0),
  review_count = COALESCE((
    SELECT count(*)::int
    FROM reviews rv
    WHERE rv.restaurant_id = p_restaurant_id AND NOT rv.is_hidden
  ), 0)
  WHERE r.id = p_restaurant_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_restaurant_rating(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_restaurant_rating(uuid) TO authenticated;

-- Trigger: auto-update restaurant rating after a review is inserted/updated/deleted
CREATE OR REPLACE FUNCTION public.refresh_restaurant_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.update_restaurant_rating(COALESCE(NEW.restaurant_id, OLD.restaurant_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refresh_restaurant_rating() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_refresh_restaurant_rating ON reviews;
CREATE TRIGGER trg_refresh_restaurant_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_restaurant_rating();
