-- ============================================================================
-- KIYO PHASE 2 — Marketplace schema
-- Tables: menu_categories, menu_items
-- Restaurants: hours, status (open/closed/busy), cuisine, avg_price, rating
-- Financials: calculate_order_financials() RPC (server-side, anonymous-safe)
-- Realtime: orders are broadcast on a per-restaurant channel by default
--           (RLS already scopes visibility in 0001; channel filter happens client-side)
-- ============================================================================

-- ---------- RESTAURANTS EXTENSIONS ----------
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS cuisine text[],
  ADD COLUMN IF NOT EXISTS avg_price_range text CHECK (avg_price_range IN ('$','$$','$$$','$$$$')),
  ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'closed'
    CHECK (status IN ('open','closed','busy')),
  ADD COLUMN IF NOT EXISTS rating numeric(2,1) NOT NULL DEFAULT 0
    CHECK (rating >= 0 AND rating <= 5),
  ADD COLUMN IF NOT EXISTS review_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_delivery_min int;

COMMENT ON COLUMN restaurants.opening_hours IS
  'JSON keyed by day index 0=Sun..6=Sat: {"0":{"open":"09:00","close":"22:00"}}. Missing key = closed.';

-- ---------- MENU CATEGORIES ----------
CREATE TABLE IF NOT EXISTS menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant ON menu_categories(restaurant_id, position);

-- ---------- MENU ITEMS ----------
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id, position);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(restaurant_id) WHERE is_available = true;

-- Trigger: updated_at on menu_items
DROP TRIGGER IF EXISTS trg_menu_items_updated ON menu_items;
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY on new tables
-- ============================================================================
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Menu categories: visible to anyone authenticated (restaurant must be discoverable);
-- writes restricted to owner + admin
CREATE POLICY menu_categories_select_visible ON menu_categories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_categories.restaurant_id
      AND (r.is_active = true OR r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

CREATE POLICY menu_categories_insert_owner_or_admin ON menu_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_categories.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

CREATE POLICY menu_categories_update_owner_or_admin ON menu_categories
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_categories.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_categories.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

CREATE POLICY menu_categories_delete_owner_or_admin ON menu_categories
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_categories.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

-- Menu items: same shape as categories
CREATE POLICY menu_items_select_visible ON menu_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_items.restaurant_id
      AND (r.is_active = true OR r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

CREATE POLICY menu_items_insert_owner_or_admin ON menu_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_items.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

CREATE POLICY menu_items_update_owner_or_admin ON menu_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_items.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_items.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

CREATE POLICY menu_items_delete_owner_or_admin ON menu_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_items.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

-- Allow restaurant owner to INSERT order_items into orders bound to their restaurant.
-- (Phase 1 only allowed customer inserts.)
CREATE POLICY order_items_insert_restaurant_owner ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.restaurant_id = public.get_user_restaurant_id()
    )
  );

-- ============================================================================
-- FINANCIAL ENGINE (server-side only)
-- calculate_order_financials(p_items jsonb, p_delivery_km numeric)
-- - looks up live prices from menu_items (never trusts client prices)
-- - applies delivery fee: 63 DZD/km, min 100 DZD
-- - applies 7% commission + 1% platform fee on (subtotal + delivery)
-- - returns { subtotal, delivery_fee, service_fee, commission, platform_fee, total }
--   service_fee is the customer-visible portion (= commission + platform_fee)
--   commission + platform_fee are internal-only
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_order_financials(
  p_items jsonb,          -- [{ "menu_item_id": uuid, "quantity": int }]
  p_delivery_km numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2);
  v_commission numeric(12,2);
  v_platform_fee numeric(12,2);
  v_service_fee numeric(12,2);
  v_total numeric(12,2);
  v_item record;
  v_mi menu_items%ROWTYPE;
  v_validated_items jsonb := '[]'::jsonb;
BEGIN
  IF NOT jsonb_typeof(p_items) = 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF p_delivery_km IS NULL OR p_delivery_km < 0 THEN
    RAISE EXCEPTION 'delivery_km must be >= 0' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (v_item.value->>'quantity')::int IS NULL OR (v_item.value->>'quantity')::int <= 0 THEN
      RAISE EXCEPTION 'invalid quantity for item %', v_item.value->>'menu_item_id'
        USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_mi FROM menu_items WHERE id = (v_item.value->>'menu_item_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'menu item not found: %', v_item.value->>'menu_item_id'
        USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_mi.is_available THEN
      RAISE EXCEPTION 'menu item out of stock: %', v_mi.name
        USING ERRCODE = 'P0003';
    END IF;

    v_subtotal := v_subtotal + (v_mi.price * (v_item.value->>'quantity')::int);

    v_validated_items := v_validated_items || jsonb_build_object(
      'name', v_mi.name,
      'quantity', (v_item.value->>'quantity')::int,
      'unit_price', v_mi.price
    );
  END LOOP;

  -- Delivery fee: 63 DZD/km, min 100 DZD
  v_delivery_fee := GREATEST(p_delivery_km * 63, 100);

  -- Platform commission (7%) + platform fee (1%) on (subtotal + delivery)
  v_commission := ROUND((v_subtotal + v_delivery_fee) * 0.07, 2);
  v_platform_fee := ROUND((v_subtotal + v_delivery_fee) * 0.01, 2);

  -- Customer-facing service fee = commission + platform_fee
  v_service_fee := v_commission + v_platform_fee;

  -- Total = subtotal + delivery + service_fee
  v_total := v_subtotal + v_delivery_fee + v_service_fee;

  RETURN jsonb_build_object(
    'items', v_validated_items,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'service_fee', v_service_fee,
    'commission', v_commission,
    'platform_fee', v_platform_fee,
    'total', v_total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_order_financials(jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_order_financials(jsonb, numeric) TO authenticated;

-- ============================================================================
-- Helper: update_restaurant_rating  (future-ready, used by reviews system)
-- Recompute avg rating from reviews (placeholder: no reviews table yet, returns void)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_restaurant_rating(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Phase 3 placeholder: when reviews table exists, recompute here.
  -- For now, no-op; rating stays at default 0.
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_restaurant_rating(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_restaurant_rating(uuid) TO service_role;

-- ============================================================================
-- Enable realtime on orders + order_items (Phase 1 left realtime flags off)
-- Channel filter is server-side: Postgres RLS still enforces row visibility.
-- Client subscribes with filter=restaurant_id=eq.<uuid> so it never receives
-- other restaurants' payloads (defense in depth).
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
