-- ============================================================================
-- KIYO Phase 3 hardening — restaurant lifecycle + transactional orders
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE restaurant_status AS ENUM
    ('draft', 'pending_approval', 'published', 'hidden', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1. Add status column, backfill from is_active (no data loss)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS status restaurant_status NOT NULL DEFAULT 'draft';

UPDATE restaurants SET status = 'published' WHERE is_active = true;
UPDATE restaurants SET status = 'pending_approval' WHERE is_active = false AND status = 'draft';

-- 2. DROP the old visibility policies FIRST (they reference is_active),
--    then drop the column itself.
DROP POLICY IF EXISTS restaurants_select_visible ON restaurants;
DROP POLICY IF EXISTS restaurants_insert_owner_or_admin ON restaurants;
DROP POLICY IF EXISTS restaurants_update_owner_or_admin ON restaurants;
DROP POLICY IF EXISTS restaurants_delete_owner_or_admin ON restaurants;

DROP POLICY IF EXISTS menu_categories_select_visible ON menu_categories;
DROP POLICY IF EXISTS menu_categories_insert_owner_or_admin ON menu_categories;
DROP POLICY IF EXISTS menu_categories_update_owner_or_admin ON menu_categories;
DROP POLICY IF EXISTS menu_categories_delete_owner_or_admin ON menu_categories;

DROP POLICY IF EXISTS menu_items_select_visible ON menu_items;
DROP POLICY IF EXISTS menu_items_insert_owner_or_admin ON menu_items;
DROP POLICY IF EXISTS menu_items_update_owner_or_admin ON menu_items;
DROP POLICY IF EXISTS menu_items_delete_owner_or_admin ON menu_items;

-- Safe to drop is_active now — nothing references it.
ALTER TABLE restaurants DROP COLUMN IF EXISTS is_active;

-- 3. visibility helper
CREATE OR REPLACE FUNCTION public.restaurant_is_visible(p_rid uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = p_rid
    AND (
      r.status = 'published'
      OR r.owner_id = p_viewer
      OR public.is_super_admin()
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.restaurant_is_visible(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurant_is_visible(uuid, uuid) TO authenticated;

-- 4. Recreate policies on restaurants with status semantics.
CREATE POLICY restaurants_select_visible ON restaurants
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR owner_id = auth.uid()
    OR public.is_super_admin()
  );

-- ONLY super_admin can create restaurants (admin-only creation rule).
CREATE POLICY restaurants_insert_admin_only ON restaurants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY restaurants_update_owner_or_admin ON restaurants
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());

CREATE POLICY restaurants_delete_admin_only ON restaurants
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- menu_categories + menu_items — one FOR ALL policy each, scoped via helper
CREATE POLICY menu_categories_select_visible ON menu_categories
  FOR SELECT TO authenticated
  USING (public.restaurant_is_visible(restaurant_id, auth.uid()));

CREATE POLICY menu_categories_manage_owner_or_admin ON menu_categories
  FOR ALL TO authenticated
  USING (public.restaurant_is_visible(restaurant_id, auth.uid()))
  WITH CHECK (public.restaurant_is_visible(restaurant_id, auth.uid()));

CREATE POLICY menu_items_select_visible ON menu_items
  FOR SELECT TO authenticated
  USING (public.restaurant_is_visible(restaurant_id, auth.uid()));

CREATE POLICY menu_items_manage_owner_or_admin ON menu_items
  FOR ALL TO authenticated
  USING (public.restaurant_is_visible(restaurant_id, auth.uid()))
  WITH CHECK (public.restaurant_is_visible(restaurant_id, auth.uid()));

-- 5. create_order_with_items(p_payload jsonb) — transactional order+items insert
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

  -- Refuse orders to non-published restaurants (race-safe check)
  IF NOT EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = v_restaurant_id AND r.status = 'published'
  ) THEN
    RAISE EXCEPTION 'restaurant is not currently accepting orders' USING ERRCODE = '55006';
  END IF;

  -- Server-side financial calculation (never trusts client prices)
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

  -- Build items insert from validated finance.items + client-supplied notes
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

  -- Audit log the order creation
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

-- 6. set_restaurant_status(uuid, restaurant_status) — admin-only lifecycle transitions, audit-logged
CREATE OR REPLACE FUNCTION public.set_restaurant_status(
  p_restaurant_id uuid, p_status restaurant_status
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old restaurant_status;
  v_owner uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'only super_admin can change restaurant status' USING ERRCODE = '42501';
  END IF;

  SELECT status, owner_id INTO v_old, v_owner
    FROM restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'restaurant not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old = p_status THEN RETURN; END IF;

  UPDATE restaurants SET status = p_status WHERE id = p_restaurant_id;

  PERFORM public.log_activity(
    'admin_action',
    'restaurant',
    p_restaurant_id,
    jsonb_build_object('action', 'status_change', 'from', v_old, 'to', p_status, 'owner_id', v_owner)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_restaurant_status(uuid, restaurant_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_restaurant_status(uuid, restaurant_status) TO authenticated;
