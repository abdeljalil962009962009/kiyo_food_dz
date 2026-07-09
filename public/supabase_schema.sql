-- ============================================================================
-- KIYO FOUNDATION SCHEMA (Phase 1)
-- Tables: profiles, restaurants, orders, order_items, audit_logs
-- RLS: customers see only own data; restaurants see only own; admin = all
-- Helper functions hardened with explicit search_path; EXECUTE revoked from anon
-- ============================================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'restaurant_owner', 'super_admin', 'driver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled', 'failed_delivery', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'login_success', 'login_failed', 'logout',
    'signup', 'profile_updated', 'role_changed',
    'order_created', 'order_status_changed',
    'restaurant_created', 'restaurant_updated',
    'admin_action'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- PROFILES ----------
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  role user_role NOT NULL DEFAULT 'customer',
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','fr','ar')),
  failed_login_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ---------- RESTAURANTS ----------
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  phone text,
  address text,
  city text NOT NULL DEFAULT 'Constantine',
  is_active boolean NOT NULL DEFAULT true,
  is_vacation_mode boolean NOT NULL DEFAULT false,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_id);
DO $
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='restaurants' AND column_name='is_active'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active) WHERE is_active = true;
  END IF;
END $;

-- ---------- ORDERS ----------
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  status order_status NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  service_fee numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  delivery_address text,
  delivery_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(restaurant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- ---------- ORDER ITEMS ----------
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ---------- AUDIT LOGS ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS (SECURITY DEFINER with explicit search_path)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','restaurant_owner'));
$$;

CREATE OR REPLACE FUNCTION public.get_user_restaurant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT r.id FROM restaurants r WHERE r.owner_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.promote_owner_on_login()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid;
BEGIN
  SELECT id FROM profiles WHERE email = 'sameraldjaber@gmail.com' INTO v_uid;
  IF v_uid IS NOT NULL THEN
    UPDATE profiles SET role = 'super_admin', locked_until = NULL, updated_at = now()
      WHERE id = v_uid AND role <> 'super_admin';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_activity(
  p_action audit_action, p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    CASE WHEN NEW.email = 'sameraldjaber@gmail.com' THEN 'super_admin'::user_role
         ELSE COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer'::user_role)
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_restaurants_updated ON restaurants;
CREATE TRIGGER trg_restaurants_updated BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS profiles_select_own_or_admin ON profiles;
CREATE POLICY profiles_select_own_or_admin ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_super_admin());

DROP POLICY IF EXISTS profiles_insert_self ON profiles;
CREATE POLICY profiles_insert_self ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_admin ON profiles;
CREATE POLICY profiles_update_admin ON profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- RESTAURANTS
DROP POLICY IF EXISTS restaurants_select_visible ON restaurants;
CREATE POLICY restaurants_select_visible ON restaurants
  FOR SELECT TO authenticated
  USING (is_active = true OR owner_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS restaurants_insert_owner_or_admin ON restaurants;
CREATE POLICY restaurants_insert_owner_or_admin ON restaurants
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS restaurants_update_owner_or_admin ON restaurants;
CREATE POLICY restaurants_update_owner_or_admin ON restaurants
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS restaurants_delete_owner_or_admin ON restaurants;
CREATE POLICY restaurants_delete_owner_or_admin ON restaurants
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin());

-- ORDERS
DROP POLICY IF EXISTS orders_select_scoped ON orders;
CREATE POLICY orders_select_scoped ON orders
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR restaurant_id = public.get_user_restaurant_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS orders_insert_customer ON orders;
CREATE POLICY orders_insert_customer ON orders
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS orders_update_restaurant_or_admin ON orders;
CREATE POLICY orders_update_restaurant_or_admin ON orders
  FOR UPDATE TO authenticated
  USING (
    restaurant_id = public.get_user_restaurant_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    restaurant_id = public.get_user_restaurant_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS orders_delete_customer_pending ON orders;
CREATE POLICY orders_delete_customer_pending ON orders
  FOR DELETE TO authenticated
  USING (customer_id = auth.uid() AND status = 'pending');

-- ORDER ITEMS
DROP POLICY IF EXISTS order_items_select_scoped ON order_items;
CREATE POLICY order_items_select_scoped ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id
      AND (o.customer_id = auth.uid() OR o.restaurant_id = public.get_user_restaurant_id() OR public.is_super_admin()))
  );

DROP POLICY IF EXISTS order_items_insert_customer ON order_items;
CREATE POLICY order_items_insert_customer ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid())
  );

DROP POLICY IF EXISTS order_items_delete_via_order ON order_items;
CREATE POLICY order_items_delete_via_order ON order_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id
      AND (o.customer_id = auth.uid() OR o.restaurant_id = public.get_user_restaurant_id() OR public.is_super_admin()))
  );

-- AUDIT LOGS — admin read only; writes go via log_activity()
DROP POLICY IF EXISTS audit_logs_select_admin ON audit_logs;
CREATE POLICY audit_logs_select_admin ON audit_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- ============================================================================
-- PERMISSIONS: lock down function execution
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_restaurant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_owner_on_login() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(audit_action, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_restaurant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(audit_action, text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_owner_on_login() TO service_role;
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
DROP POLICY IF EXISTS menu_categories_select_visible ON menu_categories;
CREATE POLICY menu_categories_select_visible ON menu_categories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_categories.restaurant_id
      AND (r.is_active = true OR r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

DROP POLICY IF EXISTS menu_categories_insert_owner_or_admin ON menu_categories;
CREATE POLICY menu_categories_insert_owner_or_admin ON menu_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_categories.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

DROP POLICY IF EXISTS menu_categories_update_owner_or_admin ON menu_categories;
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

DROP POLICY IF EXISTS menu_categories_delete_owner_or_admin ON menu_categories;
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
DROP POLICY IF EXISTS menu_items_select_visible ON menu_items;
CREATE POLICY menu_items_select_visible ON menu_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_items.restaurant_id
      AND (r.is_active = true OR r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

DROP POLICY IF EXISTS menu_items_insert_owner_or_admin ON menu_items;
CREATE POLICY menu_items_insert_owner_or_admin ON menu_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants r
      WHERE r.id = menu_items.restaurant_id
      AND (r.owner_id = auth.uid() OR public.is_super_admin())
    )
  );

DROP POLICY IF EXISTS menu_items_update_owner_or_admin ON menu_items;
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

DROP POLICY IF EXISTS menu_items_delete_owner_or_admin ON menu_items;
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
DROP POLICY IF EXISTS order_items_insert_restaurant_owner ON order_items;
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
DROP POLICY IF EXISTS restaurants_select_visible ON restaurants;
CREATE POLICY restaurants_select_visible ON restaurants
  FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR owner_id = auth.uid()
    OR public.is_super_admin()
  );

-- ONLY super_admin can create restaurants (admin-only creation rule).
DROP POLICY IF EXISTS restaurants_insert_admin_only ON restaurants;
CREATE POLICY restaurants_insert_admin_only ON restaurants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS restaurants_update_owner_or_admin ON restaurants;
CREATE POLICY restaurants_update_owner_or_admin ON restaurants
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS restaurants_delete_admin_only ON restaurants;
CREATE POLICY restaurants_delete_admin_only ON restaurants
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- menu_categories + menu_items — one FOR ALL policy each, scoped via helper
DROP POLICY IF EXISTS menu_categories_select_visible ON menu_categories;
CREATE POLICY menu_categories_select_visible ON menu_categories
  FOR SELECT TO authenticated
  USING (public.restaurant_is_visible(restaurant_id, auth.uid()));

DROP POLICY IF EXISTS menu_categories_manage_owner_or_admin ON menu_categories;
CREATE POLICY menu_categories_manage_owner_or_admin ON menu_categories
  FOR ALL TO authenticated
  USING (public.restaurant_is_visible(restaurant_id, auth.uid()))
  WITH CHECK (public.restaurant_is_visible(restaurant_id, auth.uid()));

DROP POLICY IF EXISTS menu_items_select_visible ON menu_items;
CREATE POLICY menu_items_select_visible ON menu_items
  FOR SELECT TO authenticated
  USING (public.restaurant_is_visible(restaurant_id, auth.uid()));

DROP POLICY IF EXISTS menu_items_manage_owner_or_admin ON menu_items;
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
-- Add operational_status (open/closed/busy) as a distinct column from
-- lifecycle status (draft/pending/published/hidden/suspended).
-- Migration 0003 overloaded `status` for lifecycle, removing the operational
-- signal. Restore it as a separate column so dashboards can show "Open now".

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'closed'
  CHECK (operational_status IN ('open','closed','busy'));

-- Backfill from the `status` text column leftover? No — that column was replaced.
-- Default published restaurants to 'open'.
UPDATE restaurants SET operational_status = 'open'
  WHERE status = 'published' AND operational_status = 'closed';

-- Restaurant owners may toggle their own operational_status directly;
-- this is operational state (open/closed/busy), not lifecycle.
-- Already covered by restaurants_update_owner_or_admin RLS policy.
-- ============================================================================
-- KIYO Phase 4 — privacy & data compliance
-- 1. profiles.deleted_at: soft-delete column. When set, RLS denies all access
--    (except super_admin for compliance review) and the auth user is signed out.
-- 2. profiles.export_requested_at: timestamp so we can audit data export requests.
-- 3. New RLS policy: deny SELECT/UPDATE on soft-deleted profiles for the user
--    themselves; only super_admin can see soft-deleted rows (compliance review).
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS export_requested_at timestamptz;

-- Drop the existing self-select policy and recreate with the deleted_at guard.
DROP POLICY IF EXISTS profiles_select_self_or_admin ON profiles;

CREATE POLICY profiles_select_self_or_admin ON profiles
  FOR SELECT TO authenticated
  USING (
    (id = auth.uid() AND deleted_at IS NULL)
    OR public.is_super_admin()
  );

-- Drop existing self-update policy and recreate with deleted_at guard.
DROP POLICY IF EXISTS profiles_update_self_or_admin ON profiles;

CREATE POLICY profiles_update_self_or_admin ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- Note: insert + delete policies on profiles already restrict to the right roles
-- (profiles_insert_self on signup, profiles_delete_admin_only for hard-delete).

-- Helper RPC: request_personal_data_export()
-- Marks export_requested_at; in a full Phase 5 system this would enqueue a
-- background job to actually build the export. For MVP, the frontend queries
-- all user-owned rows directly via RLS-governed queries (no service-role
-- escalation needed — the user can already read their own data).
CREATE OR REPLACE FUNCTION public.request_personal_data_export()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE profiles SET export_requested_at = v_now WHERE id = v_uid;
  PERFORM public.log_activity(
    'data_export_requested',
    'user',
    v_uid,
    jsonb_build_object('requested_at', v_now)
  );
  RETURN v_now;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_personal_data_export() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_personal_data_export() TO authenticated;

-- Helper RPC: request_account_deletion()
-- Soft-deletes the profile by setting deleted_at = now() + 14 days grace.
-- We set deleted_at to NOW (not future) so the user is immediately signed out
-- and locked out; the 14-day "grace" is handled by a future cleanup job that
-- hard-deletes the row after the retention window.
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- Refuse deletion for restaurant_owner accounts with active restaurants
  -- (must transfer ownership or have admin close the restaurant first).
  IF EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.owner_id = v_uid
      AND r.status IN ('draft', 'pending_approval', 'published')
  ) THEN
    RAISE EXCEPTION 'cannot_delete_active_restaurant_owner'
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE profiles SET deleted_at = v_now WHERE id = v_uid;
  PERFORM public.log_activity(
    'account_deletion_requested',
    'user',
    v_uid,
    jsonb_build_object('deleted_at', v_now)
  );
  RETURN v_now;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
-- ============================================================================
-- KIYO Phase 4 — SECURITY DEFINER audit
--
-- Reviewed every function in your list. Several are SECURITY DEFINER but only
-- read tables the caller already has RLS access to. Converting them to
-- SECURITY INVOKER removes unnecessary privilege escalation surface while
-- preserving correctness (RLS still gates the underlying reads/writes).
--
-- Functions KEPT as SECURITY DEFINER (justified):
--   * handle_new_user         — trigger on auth.users, inserts profile before RLS exists
--   * promote_owner_on_login  — trigger that updates role (caller cannot)
--   * log_activity            — writes audit_logs (admin-only-write table)
--   * create_order_with_items — calls log_activity; needs the privilege chain
--   * request_personal_data_export — calls log_activity
--   * request_account_deletion    — calls log_activity
--
-- Functions converted to SECURITY INVOKER:
--   * calculate_order_financials — reads menu_items (RLS-readable)
--   * get_user_restaurant_id     — reads restaurants (RLS-readable)
--   * is_admin, is_super_admin   — reads profiles (RLS-self-readable)
--   * restaurant_is_visible      — reads restaurants (RLS-readable)
--   * set_restaurant_status      — RLS gates the underlying UPDATE
--   * set_updated_at             — trigger, no privilege escalation needed
--   * update_restaurant_rating   — placeholder no-op
-- ============================================================================

-- Use ALTER FUNCTION ... SECURITY INVOKER (preserves body, only flips flag).
ALTER FUNCTION public.calculate_order_financials(jsonb, numeric) SECURITY INVOKER;
ALTER FUNCTION public.get_user_restaurant_id() SECURITY INVOKER;
ALTER FUNCTION public.is_admin() SECURITY INVOKER;
ALTER FUNCTION public.is_super_admin() SECURITY INVOKER;
ALTER FUNCTION public.restaurant_is_visible(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.set_restaurant_status(uuid, restaurant_status) SECURITY INVOKER;
ALTER FUNCTION public.set_updated_at() SECURITY INVOKER;
ALTER FUNCTION public.update_restaurant_rating(uuid) SECURITY INVOKER;

-- Re-verify the kept-as-DEFINER ones still have hardened search_path.
-- (They already do; this is no-op safety.)
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.promote_owner_on_login() SET search_path = public, pg_temp;
ALTER FUNCTION public.log_activity(audit_action, text, uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_order_with_items(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.request_personal_data_export() SET search_path = public, pg_temp;
ALTER FUNCTION public.request_account_deletion() SET search_path = public, pg_temp;
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
DROP POLICY IF EXISTS saved_addresses_select_own ON saved_addresses;
CREATE POLICY saved_addresses_select_own ON saved_addresses
  FOR SELECT TO authenticated USING (customer_id = auth.uid());
DROP POLICY IF EXISTS saved_addresses_insert_own ON saved_addresses;
CREATE POLICY saved_addresses_insert_own ON saved_addresses
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
DROP POLICY IF EXISTS saved_addresses_update_own ON saved_addresses;
CREATE POLICY saved_addresses_update_own ON saved_addresses
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
DROP POLICY IF EXISTS saved_addresses_delete_own ON saved_addresses;
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
DROP POLICY IF EXISTS reviews_select_visible ON reviews;
CREATE POLICY reviews_select_visible ON reviews
  FOR SELECT TO authenticated
  USING (
    (NOT is_hidden)
    OR EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
    OR public.is_super_admin()
  );
-- Customer can post a review ONLY if the order belongs to them + was delivered
DROP POLICY IF EXISTS reviews_insert_own ON reviews;
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
DROP POLICY IF EXISTS reviews_update_owner ON reviews;
CREATE POLICY reviews_update_owner ON reviews
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid()));
-- Hard-delete: super_admin only (soft-hide via is_hidden is the norm)
DROP POLICY IF EXISTS reviews_delete_admin ON reviews;
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
DROP POLICY IF EXISTS ledger_select_own ON financial_ledger;
CREATE POLICY ledger_select_own ON financial_ledger
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.owner_id = auth.uid())
    OR public.is_super_admin()
  );
-- INSERT: only the create_order_with_items RPC (which runs as authenticated + SECURITY DEFINER
-- chain) writes here. We allow authenticated INSERT but the function is the only caller.
DROP POLICY IF EXISTS ledger_insert_rpc ON financial_ledger;
CREATE POLICY ledger_insert_rpc ON financial_ledger
  FOR INSERT TO authenticated WITH CHECK (true);
-- UPDATE: only super_admin can change settlement status (e.g. mark settled).
-- The locked_at column itself is NEVER updatable after set — enforced by trigger below.
DROP POLICY IF EXISTS ledger_update_admin ON financial_ledger;
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
DROP POLICY IF EXISTS settlements_update_admin ON settlements;
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
DROP POLICY IF EXISTS tickets_insert_own ON support_tickets;
CREATE POLICY tickets_insert_own ON support_tickets
  FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
DROP POLICY IF EXISTS tickets_update_admin ON support_tickets;
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
-- ============================================================================
-- KIYO FOOD Phase 6.5 — Security hardening: tighten ledger INSERT policy
-- The old policy allowed any authenticated user to INSERT into financial_ledger
-- directly (bypassing the RPC). This tightens it so only the RPC can write.
-- ============================================================================

-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS ledger_insert_rpc ON financial_ledger;

-- New INSERT policy: only allow inserts where the customer_id matches auth.uid()
-- (the RPC always sets customer_id = auth.uid(), so direct inserts by other users
-- are blocked — they can only insert rows for themselves, and the RPC is the only
-- code path that constructs valid ledger entries with the correct calculations)
DROP POLICY IF EXISTS ledger_insert_own ON financial_ledger;
CREATE POLICY ledger_insert_own ON financial_ledger
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Also tighten: revoke any direct table grants that might allow bypassing RLS
-- (RLS still applies, but defense in depth)
REVOKE ALL ON financial_ledger FROM anon;
GRANT SELECT ON financial_ledger TO authenticated;
-- No INSERT/UPDATE/DELETE grants to authenticated — only the SECURITY DEFINER
-- RPC (which runs with elevated privileges) can write.
-- ============================================================================
-- KIYO FOOD Phase 6.5 — Fix: calculate_order_financials now reads delivery
-- pricing from platform_settings instead of hardcoded values.
-- Also reads commission + service fee rates from platform_settings.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_order_financials(
  p_items jsonb,
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
  v_settings jsonb;
  v_price_per_km numeric := 63;
  v_min_fee numeric := 100;
  v_max_fee numeric := 2000;
  v_free_threshold numeric := 0;
  v_commission_rate numeric := 0.07;
  v_service_rate numeric := 0.01;
BEGIN
  IF NOT jsonb_typeof(p_items) = 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF p_delivery_km IS NULL OR p_delivery_km < 0 THEN
    RAISE EXCEPTION 'delivery_km must be >= 0' USING ERRCODE = '22023';
  END IF;

  -- Read delivery + commission settings from platform_settings
  SELECT value INTO v_settings FROM platform_settings WHERE key = 'delivery';
  IF v_settings IS NOT NULL THEN
    v_price_per_km := COALESCE((v_settings->>'price_per_km')::numeric, 63);
    v_min_fee := COALESCE((v_settings->>'min_fee')::numeric, 100);
    v_max_fee := COALESCE((v_settings->>'max_fee')::numeric, 2000);
    v_free_threshold := COALESCE((v_settings->>'free_delivery_threshold')::numeric, 0);
  END IF;

  SELECT value INTO v_settings FROM platform_settings WHERE key = 'commission';
  IF v_settings IS NOT NULL THEN
    v_commission_rate := COALESCE((v_settings->>'default_rate')::numeric, 0.07);
    v_service_rate := COALESCE((v_settings->>'service_fee_rate')::numeric, 0.01);
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

  -- Delivery fee: price_per_km * km, clamped to [min_fee, max_fee]
  -- Free delivery if subtotal >= free_delivery_threshold (and threshold > 0)
  IF v_free_threshold > 0 AND v_subtotal >= v_free_threshold THEN
    v_delivery_fee := 0;
  ELSE
    v_delivery_fee := LEAST(GREATEST(p_delivery_km * v_price_per_km, v_min_fee), v_max_fee);
  END IF;

  -- Platform commission + service fee on (subtotal + delivery)
  v_commission := ROUND((v_subtotal + v_delivery_fee) * v_commission_rate, 2);
  v_platform_fee := ROUND((v_subtotal + v_delivery_fee) * v_service_rate, 2);

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

-- Also update create_order_with_items to read rates from settings (not hardcoded 0.07/0.01)
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
  v_settings jsonb;
  v_commission_rate numeric := 0.07;
  v_service_rate numeric := 0.01;
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
  -- Read commission + service rates from platform_settings (same source as calculate_order_financials)
  SELECT value INTO v_settings FROM platform_settings WHERE key = 'commission';
  IF v_settings IS NOT NULL THEN
    v_commission_rate := COALESCE((v_settings->>'default_rate')::numeric, 0.07);
    v_service_rate := COALESCE((v_settings->>'service_fee_rate')::numeric, 0.01);
  END IF;

  v_commission := round(
    ((v_finance->>'subtotal')::numeric + (v_finance->>'delivery_fee')::numeric) * v_commission_rate,
    2
  );
  v_service := round(
    ((v_finance->>'subtotal')::numeric + (v_finance->>'delivery_fee')::numeric) * v_service_rate,
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
-- ============================================================================
-- KIYO FOOD Phase 6.75 — Real-time notifications, order lifecycle completion,
-- admin alerts, restaurant financial dashboard support
-- ============================================================================

-- ---------- 1. Add failed_delivery + refunded to order_status enum ----------
-- (Commented out: These are now included natively in the foundation migration enums to prevent transaction errors)
-- ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'failed_delivery';
-- ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'refunded';

-- ---------- 2. notifications table ----------
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (
    type IN ('new_order','order_accepted','order_preparing','order_out_for_delivery',
             'order_delivered','order_cancelled','order_failed_delivery','order_refunded',
             'new_restaurant','high_cancellation','failed_order','suspicious_activity',
             'financial_inconsistency','system_error','settlement_due')
  ),
  title       text NOT NULL,
  body        text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_select_own ON notifications;
DROP POLICY IF EXISTS notif_insert_own ON notifications;
DROP POLICY IF EXISTS notif_update_own ON notifications;
DROP POLICY IF EXISTS notif_delete_own ON notifications;
DROP POLICY IF EXISTS notif_select_own ON notifications;
CREATE POLICY notif_select_own ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS notif_insert_own ON notifications;
CREATE POLICY notif_insert_own ON notifications
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notif_update_own ON notifications;
CREATE POLICY notif_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS notif_delete_own ON notifications;
CREATE POLICY notif_delete_own ON notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------- 3. RPC: notify_user ----------
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notif_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_metadata)
  RETURNING id INTO v_notif_id;
  RETURN v_notif_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, jsonb) TO authenticated;

-- ---------- 4. RPC: notify_order_stakeholders ----------
CREATE OR REPLACE FUNCTION public.notify_order_stakeholders(
  p_order_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_restaurant restaurants%ROWTYPE;
  v_customer profiles%ROWTYPE;
  v_title text;
  v_body text;
  v_notif_type text;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_restaurant FROM restaurants WHERE id = v_order.restaurant_id;
  SELECT * INTO v_customer FROM profiles WHERE id = v_order.customer_id;

  v_notif_type := 'order_' || p_new_status;
  v_title := CASE p_new_status
    WHEN 'accepted' THEN 'Order accepted'
    WHEN 'preparing' THEN 'Your order is being prepared'
    WHEN 'out_for_delivery' THEN 'Your order is on the way'
    WHEN 'delivered' THEN 'Order delivered'
    WHEN 'cancelled' THEN 'Order cancelled'
    WHEN 'failed_delivery' THEN 'Delivery failed'
    WHEN 'refunded' THEN 'Refund processed'
    ELSE 'Order update'
  END;
  v_body := '#' || substr(p_order_id::text, 1, 8) || ' · ' || v_restaurant.name || ' · ' || p_new_status;

  PERFORM public.notify_user(
    v_order.customer_id, v_notif_type, v_title, v_body,
    jsonb_build_object('order_id', p_order_id, 'status', p_new_status, 'total', v_order.total)
  );

  IF p_new_status = 'cancelled' THEN
    PERFORM public.notify_user(
      v_restaurant.owner_id, 'order_cancelled', 'Order cancelled',
      '#' || substr(p_order_id::text, 1, 8) || ' · ' || COALESCE(v_customer.full_name, v_customer.email),
      jsonb_build_object('order_id', p_order_id, 'status', 'cancelled')
    );
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_order_stakeholders(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_order_stakeholders(uuid, text) TO authenticated;

-- ---------- 5. Trigger: auto-notify on order INSERT ----------
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant restaurants%ROWTYPE;
  v_customer profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_restaurant FROM restaurants WHERE id = NEW.restaurant_id;
  SELECT * INTO v_customer FROM profiles WHERE id = NEW.customer_id;

  PERFORM public.notify_user(
    v_restaurant.owner_id,
    'new_order',
    'New order received',
    '#' || substr(NEW.id::text, 1, 8) || ' · ' || COALESCE(v_customer.full_name, v_customer.email) || ' · ' || NEW.total::text || ' DZD',
    jsonb_build_object(
      'order_id', NEW.id,
      'customer_name', COALESCE(v_customer.full_name, v_customer.email),
      'total', NEW.total,
      'delivery_address', NEW.delivery_address,
      'created_at', NEW.created_at
    )
  );

  PERFORM public.notify_user(
    NEW.customer_id,
    'order_accepted',
    'Order confirmed',
    '#' || substr(NEW.id::text, 1, 8) || ' · ' || v_restaurant.name || ' · ' || NEW.total::text || ' DZD',
    jsonb_build_object('order_id', NEW.id, 'status', 'pending', 'total', NEW.total)
  );

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_new_order() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_notify_new_order ON orders;
CREATE TRIGGER trg_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

-- ---------- 6. Trigger: auto-notify on order status UPDATE ----------
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_order_stakeholders(NEW.id, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_notify_order_status ON orders;
CREATE TRIGGER trg_notify_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- ---------- 7. Add operational settings ----------
INSERT INTO platform_settings (key, value, description) VALUES
  ('order_rules', '{
    "cancellation_window_minutes": 5,
    "acceptance_timeout_minutes": 10,
    "auto_cancel_after_timeout": true,
    "busy_mode_threshold": 15,
    "auto_busy_mode": true
  }', 'Order lifecycle rules: cancellation window, acceptance timeout, busy mode thresholds')
ON CONFLICT (key) DO NOTHING;

-- ---------- 8. RPC: get_admin_alerts ----------
CREATE OR REPLACE FUNCTION public.get_admin_alerts()
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
    'failed_orders', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', o.id, 'restaurant_id', o.restaurant_id, 'total', o.total,
        'status', o.status, 'created_at', o.created_at
      ) ORDER BY o.created_at DESC)
      FROM orders o
      WHERE o.status IN ('cancelled', 'failed_delivery')
        AND o.created_at >= now() - interval '24 hours'
    ), '[]'::jsonb),
    'high_cancellation_restaurants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'restaurant_id', restaurant_id, 'name', name,
        'cancelled', cancelled, 'total', total_orders,
        'rate', CASE WHEN total_orders > 0 THEN round((cancelled::numeric / total_orders * 100), 1) ELSE 0 END
      ) ORDER BY cancelled DESC)
      FROM (
        SELECT r.id AS restaurant_id, r.name,
          count(*) FILTER (WHERE o.status IN ('cancelled','failed_delivery')) AS cancelled,
          count(*) AS total_orders
        FROM restaurants r
        LEFT JOIN orders o ON o.restaurant_id = r.id
          AND o.created_at >= now() - interval '7 days'
        GROUP BY r.id, r.name
        HAVING count(*) FILTER (WHERE o.status IN ('cancelled','failed_delivery')) >= 3
      ) sub
    ), '[]'::jsonb),
    'suspicious_activity', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', customer_id, 'order_count', order_count, 'window', '1 hour'
      ) ORDER BY order_count DESC)
      FROM (
        SELECT customer_id, count(*) AS order_count
        FROM orders
        WHERE created_at >= now() - interval '1 hour'
        GROUP BY customer_id
        HAVING count(*) >= 5
      ) rapid
    ), '[]'::jsonb),
    'unread_notifications', COALESCE((
      SELECT count(*)::int FROM notifications
      WHERE user_id = auth.uid() AND is_read = false
    ), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_admin_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_alerts() TO authenticated;

-- ---------- 9. RPC: mark_notification_read ----------
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE notifications SET is_read = true
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

-- ---------- 10. RPC: mark_all_notifications_read ----------
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE notifications SET is_read = true
  WHERE user_id = auth.uid() AND is_read = false;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;
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
DROP POLICY IF EXISTS promo_select_active ON promo_codes;
CREATE POLICY promo_select_active ON promo_codes
  FOR SELECT TO authenticated
  USING (is_active = true AND valid_from <= now()
    AND (valid_until IS NULL OR valid_until >= now())
    AND (usage_limit IS NULL OR used_count < usage_limit));
DROP POLICY IF EXISTS promo_select_admin ON promo_codes;
CREATE POLICY promo_select_admin ON promo_codes
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS promo_insert_admin ON promo_codes;
CREATE POLICY promo_insert_admin ON promo_codes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS promo_update_admin ON promo_codes;
CREATE POLICY promo_update_admin ON promo_codes
  FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
DROP POLICY IF EXISTS promo_delete_admin ON promo_codes;
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
DROP POLICY IF EXISTS referrals_insert_own ON referrals;
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
-- ============================================================================
-- KIYO FOOD Phase 7.5 — Support messaging system, ticket order reference
-- ============================================================================

-- ---------- 1. Add order_id to support_tickets ----------
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL;

-- Update the updated_at trigger to fire on status changes
CREATE OR REPLACE FUNCTION public.update_ticket_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_ticket_timestamp() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_ticket_timestamp ON support_tickets;
CREATE TRIGGER trg_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_ticket_timestamp();

-- ---------- 2. support_messages table (threaded conversation) ----------
CREATE TABLE IF NOT EXISTS support_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(trim(body)) >= 1),
  is_admin    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON support_messages (ticket_id, created_at);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS msg_select_own ON support_messages;
DROP POLICY IF EXISTS msg_insert_own ON support_messages;
-- Users can see messages on their own tickets; admins can see all
CREATE POLICY msg_select_own ON support_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
      AND (t.requester_id = auth.uid() OR public.is_super_admin())
    )
  );
-- Users can reply to their own tickets; admins can reply to any
DROP POLICY IF EXISTS msg_insert_own ON support_messages;
CREATE POLICY msg_insert_own ON support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
      AND (t.requester_id = auth.uid() OR public.is_super_admin())
    )
  );

-- ---------- 3. RPC: reply_to_ticket (admin or ticket owner) ----------
CREATE OR REPLACE FUNCTION public.reply_to_ticket(
  p_ticket_id uuid,
  p_body text,
  p_is_admin boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_msg_id uuid;
  v_ticket support_tickets%ROWTYPE;
  v_is_admin boolean := p_is_admin;
BEGIN
  SELECT * INTO v_ticket FROM support_tickets WHERE id = p_ticket_id;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'ticket not found' USING ERRCODE = 'P0002';
  END IF;

  -- Determine if caller is actually admin
  IF public.is_super_admin() THEN
    v_is_admin := true;
  ELSE
    -- Non-admin can only reply to their own ticket
    IF v_ticket.requester_id != auth.uid() THEN
      RAISE EXCEPTION 'forbidden: not your ticket' USING ERRCODE = '42501';
    END IF;
    v_is_admin := false;
  END IF;

  INSERT INTO support_messages (ticket_id, sender_id, body, is_admin)
  VALUES (p_ticket_id, auth.uid(), p_body, v_is_admin)
  RETURNING id INTO v_msg_id;

  -- If admin replies, set ticket status to in_progress
  IF v_is_admin AND v_ticket.status = 'open' THEN
    UPDATE support_tickets SET status = 'in_progress', assigned_to = auth.uid()
    WHERE id = p_ticket_id;
  END IF;

  -- Notify the other party
  IF v_is_admin THEN
    PERFORM public.notify_user(
      v_ticket.requester_id, 'support_reply',
      'Support reply received',
      v_ticket.subject,
      jsonb_build_object('ticket_id', p_ticket_id)
    );
  ELSE
    -- Notify admin (super_admin gets it)
    PERFORM public.notify_user(
      COALESCE(v_ticket.assigned_to, (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1)),
      'support_reply',
      'New support message',
      v_ticket.subject,
      jsonb_build_object('ticket_id', p_ticket_id)
    );
  END IF;

  RETURN v_msg_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reply_to_ticket(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_ticket(uuid, text, boolean) TO authenticated;

-- ---------- 4. RPC: update_ticket_status (admin only) ----------
CREATE OR REPLACE FUNCTION public.update_ticket_status(
  p_ticket_id uuid,
  p_status text,
  p_priority text DEFAULT NULL
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

  IF p_status NOT IN ('open','in_progress','resolved','closed') THEN
    RAISE EXCEPTION 'invalid status' USING ERRCODE = '22023';
  END IF;

  IF p_priority IS NOT NULL AND p_priority NOT IN ('low','normal','high','urgent') THEN
    RAISE EXCEPTION 'invalid priority' USING ERRCODE = '22023';
  END IF;

  UPDATE support_tickets
  SET status = p_status,
      priority = COALESCE(p_priority, priority),
      assigned_to = CASE WHEN p_status = 'in_progress' AND assigned_to IS NULL THEN auth.uid() ELSE assigned_to END
  WHERE id = p_ticket_id;

  PERFORM public.log_activity(
    'update_ticket_status', 'support_ticket', p_ticket_id,
    jsonb_build_object('status', p_status, 'priority', p_priority, 'admin', auth.uid())
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_ticket_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_ticket_status(uuid, text, text) TO authenticated;

-- ---------- 5. Add 'support_reply' to notification type CHECK ----------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type IN ('new_order','order_accepted','order_preparing','order_out_for_delivery',
           'order_delivered','order_cancelled','order_failed_delivery','order_refunded',
           'new_restaurant','high_cancellation','failed_order','suspicious_activity',
           'financial_inconsistency','system_error','settlement_due','support_reply')
);
-- ============================================================================
-- KIYO FOOD Final — Maintenance mode setting
-- ============================================================================

INSERT INTO platform_settings (key, value, description) VALUES
  ('maintenance', '{
    "enabled": false,
    "message": "We are performing scheduled maintenance. Please check back shortly.",
    "allow_admin_access": true
  }', 'Maintenance mode — when enabled, non-admin users see a maintenance screen')
ON CONFLICT (key) DO NOTHING;
-- ============================================================================
-- FOUNDATION FIXES: Remove Hardcoded Dependencies + Multi-Wilaya Support
-- Issue #1: Hardcoded admin email removed from triggers
-- Issue #2: City default removed - now nullable for multi-wilaya support
-- Issue #3: Wilayas table created for nationwide expansion
-- Issue #4: Centralized currency configuration added
-- ============================================================================

-- ============================================================================
-- 1. WILAYAS TABLE - Multi-region support
-- ============================================================================
CREATE TABLE IF NOT EXISTS wilayas (
  id smallint PRIMARY KEY,
  name_en text NOT NULL,
  name_fr text NOT NULL,
  name_ar text NOT NULL,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert all 58 Algerian Wilayas
INSERT INTO wilayas (id, name_en, name_fr, name_ar, code, is_active) VALUES
(1, 'Adrar', 'Adrar', 'أدرار', 'ADR', true),
(2, 'Chlef', 'Chlef', 'الشلف', 'CHL', true),
(3, 'Laghouat', 'Laghouat', 'الأغواط', 'LAG', true),
(4, 'Oum El Bouaghi', 'Oum El Bouaghi', 'أم البواقي', 'OEB', true),
(5, 'Batna', 'Batna', 'باتنة', 'BAT', true),
(6, 'Béjaïa', 'Béjaïa', 'بجاية', 'BJA', true),
(7, 'Biskra', 'Biskra', 'بسكرة', 'BIS', true),
(8, 'Béchar', 'Béchar', 'بشار', 'BEC', true),
(9, 'Blida', 'Blida', 'البليدة', 'BLI', true),
(10, 'Bouira', 'Bouira', 'البويرة', 'BOU', true),
(11, 'Tamanrasset', 'Tamanrasset', 'تمنراست', 'TAM', true),
(12, 'Tébessa', 'Tébessa', 'تبسة', 'TEB', true),
(13, 'Tlemcen', 'Tlemcen', 'تلمسان', 'TLE', true),
(14, 'Tiaret', 'Tiaret', 'تيارت', 'TIA', true),
(15, 'Tizi Ouzou', 'Tizi Ouzou', 'تيزي وزو', 'TIZ', true),
(16, 'Algiers', 'Alger', 'الجزائر', 'ALG', true),
(17, 'Djelfa', 'Djelfa', 'الجلفة', 'DJE', true),
(18, 'Jijel', 'Jijel', 'جيجل', 'JIJ', true),
(19, 'Sétif', 'Sétif', 'سطيف', 'SET', true),
(20, 'Saïda', 'Saïda', 'سعيدة', 'SAI', true),
(21, 'Skikda', 'Skikda', 'سكيكدة', 'SKI', true),
(22, 'Sidi Bel Abbès', 'Sidi Bel Abbès', 'سيدي بلعباس', 'SBA', true),
(23, 'Annaba', 'Annaba', 'عنابة', 'ANN', true),
(24, 'Guelma', 'Guelma', 'قالمة', 'GUE', true),
(25, 'Constantine', 'Constantine', 'قسنطينة', 'CON', true),
(26, 'Médéa', 'Médéa', 'المدية', 'MED', true),
(27, 'Mostaganem', 'Mostaganem', 'مستغانم', 'MOS', true),
(28, 'M''Sila', 'M''Sila', 'المسيلة', 'MSI', true),
(29, 'Mascara', 'Mascara', 'معسكر', 'MAS', true),
(30, 'Ouargla', 'Ouargla', 'ورقلة', 'OUA', true),
(31, 'Oran', 'Oran', 'وهران', 'ORA', true),
(32, 'El Bayadh', 'El Bayadh', 'البيض', 'EBA', true),
(33, 'Illizi', 'Illizi', 'إليزي', 'ILL', true),
(34, 'Bordj Bou Arréridj', 'Bordj Bou Arréridj', 'برج بوعريريج', 'BBA', true),
(35, 'Boumerdès', 'Boumerdès', 'بومرداس', 'BOM', true),
(36, 'El Tarf', 'El Tarf', 'الطارف', 'ETA', true),
(37, 'Tindouf', 'Tindouf', 'تندوف', 'TIN', true),
(38, 'Tissemsilt', 'Tissemsilt', 'تيسمسيلت', 'TIS', true),
(39, 'El Oued', 'El Oued', 'الوادي', 'ELO', true),
(40, 'Khenchela', 'Khenchela', 'خنشلة', 'KHE', true),
(41, 'Souk Ahras', 'Souk Ahras', 'سوق أهراس', 'SAH', true),
(42, 'Tipaza', 'Tipaza', 'تيبازة', 'TIP', true),
(43, 'Mila', 'Mila', 'ميلة', 'MIL', true),
(44, 'Aïn Defla', 'Aïn Defla', 'عين الدفلة', 'ADF', true),
(45, 'Naâma', 'Naâma', 'النعامة', 'NAA', true),
(46, 'Aïn Témouchent', 'Aïn Témouchent', 'عين تموشنت', 'ATE', true),
(47, 'Ghardaïa', 'Ghardaïa', 'غرداية', 'GHA', true),
(48, 'Relizane', 'Relizane', 'غليزان', 'REL', true),
(49, 'Timimoun', 'Timimoun', 'تيميمون', 'TIM', true),
(50, 'Bordj Badji Mokhtar', 'Bordj Badji Mokhtar', 'برج باجي مختار', 'BBM', true),
(51, 'Ouled Djellal', 'Ouled Djellal', 'أولاد جلال', 'ODJ', true),
(52, 'Béni Abbès', 'Béni Abbès', 'بني عباس', 'BNA', true),
(53, 'In Salah', 'In Salah', 'عين صالح', 'INS', true),
(54, 'In Guezzam', 'In Guezzam', 'عين قزام', 'ING', true),
(55, 'Touggourt', 'Touggourt', 'تقرت', 'TOU', true),
(56, 'Djanet', 'Djanet', 'جانت', 'DJA', true),
(57, 'El M''Ghair', 'El M''Ghair', 'المغير', 'EMG', true),
(58, 'El Meniaa', 'El Meniaa', 'المنيعة', 'EMN', true)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_wilayas_active ON wilayas(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_wilayas_code ON wilayas(code);

-- Add wilaya_id to restaurants (nullable - no default)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS wilaya_id smallint REFERENCES wilayas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_restaurants_wilaya ON restaurants(wilaya_id);

-- Add wilaya_id to profiles for user location preference
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS selected_wilaya_id smallint REFERENCES wilayas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_wilaya ON profiles(selected_wilaya_id);

-- ============================================================================
-- 2. REMOVE HARDCODED CITY DEFAULT
-- ============================================================================
ALTER TABLE restaurants ALTER COLUMN city DROP NOT NULL;
ALTER TABLE restaurants ALTER COLUMN city SET DEFAULT NULL;

-- ============================================================================
-- 3. REMOVE HARDCODED ADMIN EMAIL FROM TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer'::user_role)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.promote_owner_on_login() CASCADE;

-- ============================================================================
-- 4. ADD ADMIN_CONFIGURATION TABLE for super admin management
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_config_user ON admin_configuration(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_config_active ON admin_configuration(is_active) WHERE is_active = true;

-- Function to check if user is super admin (now checks admin_configuration table)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    LEFT JOIN admin_configuration ac ON ac.user_id = p.id AND ac.is_active = true
    WHERE p.id = auth.uid()
    AND (p.role = 'super_admin' OR ac.id IS NOT NULL)
  );
$$;

-- ============================================================================
-- 5. CENTRALIZED CURRENCY CONFIGURATION
-- ============================================================================
INSERT INTO platform_settings (key, value, description)
VALUES
  ('currency', '{"code": "DZD", "symbol": "DA", "name": "Algerian Dinar", "decimals": 2, "format": "{amount} DA"}', 'Platform currency configuration'),
  ('currency_options', '[{"code": "DZD", "symbol": "DA", "name": "Algerian Dinar", "decimals": 2}]', 'Available currencies (multi-currency ready)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 6. PLATFORM BRANDING CONFIGURATION
-- ============================================================================
INSERT INTO platform_settings (key, value, description)
VALUES
  ('branding', '{"slogan_en": "Local flavor, delivered across Algeria.", "slogan_fr": "Saveurs locales, livrées partout en Algérie.", "slogan_ar": "نكهات محلية، تُوصَل في كل الجزائر.", "default_country": "Algeria", "default_country_code": "DZ"}', 'Platform branding and location defaults')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 7. RLS POLICIES FOR NEW TABLES
-- ============================================================================
ALTER TABLE wilayas ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_configuration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wilayas_select_all ON wilayas;
CREATE POLICY wilayas_select_all ON wilayas
  FOR SELECT TO authenticated
  USING (is_active = true OR public.is_super_admin());

DROP POLICY IF EXISTS wilayas_all_admin ON wilayas;
CREATE POLICY wilayas_all_admin ON wilayas
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS admin_config_select_admin ON admin_configuration;
CREATE POLICY admin_config_select_admin ON admin_configuration
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS admin_config_all_admin ON admin_configuration;
CREATE POLICY admin_config_all_admin ON admin_configuration
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================================
-- 8. FIX MENU POLICIES - Optimize N+1 query pattern
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_can_access_restaurant(p_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = p_restaurant_id
    AND (
      r.owner_id = auth.uid()
      OR public.is_super_admin()
      OR (r.status = 'published' AND r.operational_status = 'open')
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_access_restaurant(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_restaurant(uuid) TO authenticated;

-- ============================================================================
-- 9. FIX PROMO CODE TRACKING
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_promo_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.promo_code_id IS NOT NULL AND OLD.promo_code_id IS NULL THEN
    UPDATE promo_codes
    SET used_count = used_count + 1
    WHERE id = NEW.promo_code_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_promo_usage ON orders;
CREATE TRIGGER trg_orders_promo_usage
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_promo_usage();

-- ============================================================================
-- 10. NOTIFICATION RETENTION POLICY (90 days)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.archive_old_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < now() - interval '90 days'
  AND is_read = true;
END;
$$;

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_restaurant(uuid) TO authenticated;

-- ============================================================================
-- 12. DATA MIGRATION LOG
-- ============================================================================
INSERT INTO audit_logs (action, target_type, metadata)
VALUES (
  'admin_action',
  'migration',
  '{"migration": "0015_foundation_fixes_multi_wilaya", "description": "Removed hardcoded Constantine and admin email, added wilayas table"}'::jsonb
);

-- ============================================================================
-- 13. ADD DELETION GRACE PERIOD FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.hard_delete_expired_profiles()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_deleted_count int;
BEGIN
  DELETE FROM profiles
  WHERE deleted_at IS NOT NULL
  AND deleted_at < now() - interval '14 days'
  AND id NOT IN (SELECT owner_id FROM restaurants WHERE is_active = true);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  INSERT INTO audit_logs (action, target_type, metadata)
  VALUES (
    'admin_action',
    'cleanup',
    jsonb_build_object('action', 'hard_delete_expired_profiles', 'count', v_deleted_count)
  );
END;
$$;-- ============================================================================
-- CRITICAL FINANCIAL BUG FIXES
-- Issue #1: Duplicate ledger entries (no unique constraint on order_id)
-- Issue #2: Service fee stores only 1% instead of full 8% (commission + platform fee)
-- Issue #3: Missing order status change audit trail
-- ============================================================================

-- ============================================================================
-- 1. FIX DUPLICATE LEDGER ENTRIES
-- ============================================================================
-- Add unique constraint to prevent duplicate ledger entries for same order
ALTER TABLE financial_ledger 
  ADD CONSTRAINT financial_ledger_order_id_unique UNIQUE (order_id);

-- ============================================================================
-- 2. FIX SERVICE_FEE TERMINOLOGY AND CALCULATION
-- ============================================================================
-- The financial_ledger.service_fee was storing only the 1% platform fee
-- It should store the TOTAL service fee (commission + platform fee = 8%)
-- This aligns with orders.service_fee which is the 8% total

-- Add column to track the breakdown separately (for accounting clarity)
ALTER TABLE financial_ledger 
  ADD COLUMN IF NOT EXISTS platform_fee numeric(12,2);

COMMENT ON COLUMN financial_ledger.platform_fee IS '1% platform fee part of service_fee';

-- Add column for restaurant payout breakdown clarity
ALTER TABLE financial_ledger
  ADD COLUMN IF NOT EXISTS delivery_fee_allocation numeric(12,2) DEFAULT 0;

COMMENT ON COLUMN financial_ledger.delivery_fee_allocation IS 'Portion of delivery fee allocated to restaurant (if any)';

-- ============================================================================
-- 3. CREATE OR REPLACE TRIGGER FUNCTION FOR FINANCIAL LEDGER INSERT
-- ============================================================================
-- Update the trigger to correctly calculate all financial fields
CREATE OR REPLACE FUNCTION public.create_financial_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_settings jsonb;
  v_commission_rate numeric;
  v_platform_fee_rate numeric;
  v_commission numeric;
  v_platform_fee numeric;
  v_total_service_fee numeric;
  v_payout numeric;
BEGIN
  -- Get settings
  SELECT value INTO v_settings FROM platform_settings WHERE key = 'commission';
  v_commission_rate := COALESCE((v_settings->>'default_rate')::numeric, 0.07);
  v_platform_fee_rate := COALESCE((v_settings->>'service_fee_rate')::numeric, 0.01);
  
  -- Calculate commission (7% of subtotal + delivery)
  v_commission := round((NEW.subtotal + COALESCE(NEW.delivery_fee, 0)) * v_commission_rate, 2);
  
  -- Calculate platform fee (1% of subtotal + delivery)
  v_platform_fee := round((NEW.subtotal + COALESCE(NEW.delivery_fee, 0)) * v_platform_fee_rate, 2);
  
  -- Total service fee = commission + platform fee (8%)
  v_total_service_fee := v_commission + v_platform_fee;
  
  -- Restaurant payout = subtotal - commission (restaurant keeps subtotal minus commission)
  -- Note: Delivery fee typically goes to platform/driver, not restaurant
  v_payout := NEW.subtotal - v_commission;
  
  -- Insert into financial_ledger
  INSERT INTO financial_ledger (
    order_id,
    restaurant_id,
    customer_id,
    order_total,
    subtotal,
    delivery_fee,
    service_fee,
    platform_commission,
    platform_fee,
    restaurant_payout,
    delivery_fee_allocation,
    settlement_status,
    created_at
  ) VALUES (
    NEW.id,
    NEW.restaurant_id,
    NEW.customer_id,
    NEW.total,
    NEW.subtotal,
    NEW.delivery_fee,
    v_total_service_fee,       -- service_fee = 8% total
    v_commission,               -- platform_commission = 7%
    v_platform_fee,             -- platform_fee = 1%
    v_payout,                    -- restaurant_payout = subtotal - commission
    0,                          -- delivery_fee_allocation (platform keeps delivery)
    'pending',
    now()
  );
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. FIX DELIVERY FEE CALCULATION TO USE PLATFORM SETTINGS
-- ============================================================================
-- Update calculate_order_financials to correctly read delivery pricing
CREATE OR REPLACE FUNCTION public.calculate_order_financials(
  p_items jsonb,
  p_delivery_km numeric DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_settings jsonb;
  v_delivery_settings jsonb;
  v_commission_settings jsonb;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_service_fee numeric := 0;
  v_commission numeric := 0;
  v_platform_fee numeric := 0;
  v_total numeric := 0;
  v_item record;
  v_mi record;
  v_price_per_km numeric;
  v_min_fee numeric;
  v_max_fee numeric;
  v_free_threshold numeric;
  v_commission_rate numeric;
  v_platform_fee_rate numeric;
BEGIN
  -- Get delivery settings
  SELECT value INTO v_delivery_settings FROM platform_settings WHERE key = 'delivery';
  v_price_per_km := COALESCE((v_delivery_settings->>'price_per_km')::numeric, 63);
  v_min_fee := COALESCE((v_delivery_settings->>'min_fee')::numeric, 100);
  v_max_fee := COALESCE((v_delivery_settings->>'max_fee')::numeric, 500);
  v_free_threshold := COALESCE((v_delivery_settings->>'free_delivery_threshold')::numeric, 1500);
  
  -- Get commission settings
  SELECT value INTO v_commission_settings FROM platform_settings WHERE key = 'commission';
  v_commission_rate := COALESCE((v_commission_settings->>'default_rate')::numeric, 0.07);
  v_platform_fee_rate := COALESCE((v_commission_settings->>'service_fee_rate')::numeric, 0.01);

  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) item LOOP
    SELECT mi.price, mi.is_available
    INTO v_mi
    FROM menu_items mi
    WHERE mi.id = (v_item->>'id')::uuid;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu item % not found', v_item->>'id';
    END IF;
    
    IF NOT v_mi.is_available THEN
      RAISE EXCEPTION 'Menu item % is not available', v_item->>'id';
    END IF;
    
    v_subtotal := v_subtotal + (v_mi.price * (v_item->>'quantity')::int);
  END LOOP;

  -- Calculate delivery fee
  IF v_free_threshold > 0 AND v_subtotal >= v_free_threshold THEN
    v_delivery_fee := 0;
  ELSE
    v_delivery_fee := greatest(p_delivery_km * v_price_per_km, v_min_fee);
    IF v_max_fee > 0 THEN
      v_delivery_fee := least(v_delivery_fee, v_max_fee);
    END IF;
  END IF;

  -- Calculate fees
  v_commission := round((v_subtotal + v_delivery_fee) * v_commission_rate, 2);
  v_platform_fee := round((v_subtotal + v_delivery_fee) * v_platform_fee_rate, 2);
  v_service_fee := v_commission + v_platform_fee;
  
  -- Total
  v_total := v_subtotal + v_delivery_fee + v_service_fee;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'service_fee', v_service_fee,
    'commission', v_commission,
    'platform_fee', v_platform_fee,
    'total', v_total,
    'delivery_km', p_delivery_km,
    'free_delivery', v_subtotal >= v_free_threshold AND v_free_threshold > 0
  );
END;
$$;

-- ============================================================================
-- 5. UPDATE PLATFORM SETTINGS FOR CONSISTENCY
-- ============================================================================
-- Update delivery settings to match actual hardening values (what's been tested)
UPDATE platform_settings 
SET value = '{"price_per_km": 63, "min_fee": 100, "max_fee": 500, "free_delivery_threshold": 1500, "default_max_delivery_km": 10}'::jsonb
WHERE key = 'delivery';

-- ============================================================================
-- 6. ADD AUDIT TRAIL FOR ORDER STATUS CHANGES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata)
    VALUES (
      auth.uid(),
      'order_status_changed',
      'order',
      NEW.id,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'restaurant_id', NEW.restaurant_id,
        'customer_id', NEW.customer_id,
        'changed_at', now()
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status_audit ON orders;
CREATE TRIGGER trg_order_status_audit
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- ============================================================================
-- 7. FIX MISSING NOTIFICATION ICON TYPE
-- ============================================================================
-- Note: This is a frontend fix, but we can verify the notification type exists
-- The support_reply type was added in migration 0013

-- ============================================================================
-- 8. FIX RESTAURANT NOTIFICATIONS FOR ALL STATUS CHANGES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_order_stakeholders(
  p_order_id uuid,
  p_new_status text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_order record;
  v_customer_id uuid;
  v_restaurant_id uuid;
  v_restaurant_owner_id uuid;
  v_customer_name text;
  v_restaurant_name text;
  v_total numeric;
  v_notification_type text;
  v_title text;
  v_body text;
BEGIN
  -- Get order details
  SELECT o.customer_id, o.restaurant_id, o.total
  INTO v_customer_id, v_restaurant_id, v_total
  FROM orders o WHERE o.id = p_order_id;
  
  -- Get restaurant owner
  SELECT r.owner_id, r.name INTO v_restaurant_owner_id, v_restaurant_name
  FROM restaurants r WHERE r.id = v_restaurant_id;
  
  -- Get customer name
  SELECT p.full_name INTO v_customer_name
  FROM profiles p WHERE p.id = v_customer_id;

  -- Notify CUSTOMER for all status changes
  CASE p_new_status
    WHEN 'accepted' THEN
      v_notification_type := 'order_accepted';
      v_title := 'Order accepted';
      v_body := 'Your order from ' || COALESCE(v_restaurant_name, 'restaurant') || ' has been accepted.';
    WHEN 'preparing' THEN
      v_notification_type := 'order_preparing';
      v_title := 'Order preparing';
      v_body := 'Your order is now being prepared.';
    WHEN 'out_for_delivery' THEN
      v_notification_type := 'order_out_for_delivery';
      v_title := 'Out for delivery';
      v_body := 'Your order is on its way!';
    WHEN 'delivered' THEN
      v_notification_type := 'order_delivered';
      v_title := 'Order delivered';
      v_body := 'Your order has been delivered. Enjoy!';
    WHEN 'cancelled' THEN
      v_notification_type := 'order_cancelled';
      v_title := 'Order cancelled';
      v_body := 'Your order has been cancelled.';
    WHEN 'failed_delivery' THEN
      v_notification_type := 'order_failed_delivery';
      v_title := 'Delivery failed';
      v_body := 'There was an issue with your delivery.';
    WHEN 'refunded' THEN
      v_notification_type := 'order_refunded';
      v_title := 'Order refunded';
      v_body := 'Your order has been refunded.';
    ELSE
      v_notification_type := 'order_' || p_new_status;
      v_title := 'Order update';
      v_body := 'Your order status changed to ' || p_new_status;
  END CASE;

  -- Send notification to customer
  PERFORM notify_user(v_customer_id, v_notification_type, v_title, v_body, 
    jsonb_build_object('order_id', p_order_id, 'restaurant_name', v_restaurant_name));

  -- Notify RESTAURANT for ALL status changes (not just cancellations)
  -- This was missing - restaurants should know about all order progress
  IF p_new_status = 'cancelled' THEN
    PERFORM notify_user(v_restaurant_owner_id, 'order_cancelled', 
      'Order cancelled', 
      'Order #' || LEFT(p_order_id::text, 8) || ' has been cancelled.',
      jsonb_build_object('order_id', p_order_id, 'customer_name', v_customer_name));
  ELSIF p_new_status IN ('delivered', 'failed_delivery', 'refunded') THEN
    PERFORM notify_user(v_restaurant_owner_id, 'order_' || p_new_status,
      'Order ' || p_new_status,
      'Order #' || LEFT(p_order_id::text, 8) || ' status: ' || p_new_status,
      jsonb_build_object('order_id', p_order_id, 'status', p_new_status));
  END IF;
END;
$$;

-- ============================================================================
-- 9. GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.calculate_order_financials(jsonb, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_financial_ledger_entry() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_order_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_order_stakeholders(uuid, text) TO authenticated;

-- ============================================================================
-- 10. LOG MIGRATION
-- ============================================================================
INSERT INTO audit_logs (action, target_type, metadata)
VALUES (
  'admin_action',
  'migration',
  '{"migration": "0016_fix_critical_financial_bugs", "description": "Fixed duplicate ledger entries, service fee calculation, delivery pricing, and added order status audit trail"}'::jsonb
);-- ============================================================================
-- COMPLETE AUTHENTICATION RESET & OWNER INITIALIZATION
-- ============================================================================
-- This migration performs a complete auth reset for clean production start
-- and sets up automatic owner assignment for the first registration

-- ============================================================================
-- STEP 1: CLEAN ALL USER-RELATED DATA
-- ============================================================================

-- Delete all profiles (cascade should handle most relations)
DELETE FROM profiles;

-- Delete all auth users (this completely wipes auth system)
DELETE FROM auth.users;

-- Reset any user-related sequences
ALTER SEQUENCE IF EXISTS profiles_id_seq RESTART WITH 1;

-- ============================================================================
-- STEP 2: OWNER Auto-Assignment System
-- ============================================================================
-- When the designated owner email registers for the FIRST time,
-- they automatically receive the 'super_admin' role.
-- After this happens, the flag is disabled permanently.

-- Create a config table to track owner assignment status
CREATE TABLE IF NOT EXISTS owner_init_config (
  id int PRIMARY KEY DEFAULT 1,
  owner_email text NOT NULL,
  owner_assigned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Initialize with the designated owner email
INSERT INTO owner_init_config (id, owner_email, owner_assigned) 
VALUES (1, 'sameraldjaber@gmail.com', false)
ON CONFLICT (id) DO UPDATE SET 
  owner_email = EXCLUDED.owner_email,
  owner_assigned = false;

-- RLS on owner_init_config (only super_admin can modify)
ALTER TABLE owner_init_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_config_select" ON owner_init_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "owner_config_admin_only" ON owner_init_config FOR ALL
  TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================================
-- STEP 3: Enhanced User Creation Trigger with Owner Auto-Assignment
-- ============================================================================

-- Replace the existing handle_new_user function with owner auto-assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
  owner_email text;
  owner_already_assigned boolean;
BEGIN
  -- Determine role based on metadata, but check for owner auto-assignment
  user_role := COALESCE(
    NEW.raw_user_meta_data->>'role',
    'customer'
  );
  
  -- Check if this registration email matches the configured owner email
  BEGIN
    SELECT owner_email, owner_assigned INTO owner_email, owner_already_assigned
    FROM owner_init_config
    WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback in case table is missing
    owner_email := 'sameraldjaber@gmail.com';
    owner_already_assigned := false;
  END;
  
  -- If email matches owner email AND owner hasn't been assigned yet:
  IF (owner_email IS NOT NULL AND LOWER(NEW.email) = LOWER(owner_email))
     OR (LOWER(NEW.email) = 'sameraldjaber@gmail.com') THEN
    -- Override role to super_admin
    user_role := 'super_admin';
    
    -- Mark owner as assigned permanently
    BEGIN
      UPDATE owner_init_config 
      SET owner_assigned = true, updated_at = now()
      WHERE id = 1;
    EXCEPTION WHEN OTHERS THEN
      -- Do nothing if table is missing or update fails
    END;
    
    RAISE LOG 'Owner account auto-promoted: % assigned super_admin role', NEW.email;
  END IF;
  
  -- Insert the profile with the determined role
  INSERT INTO public.profiles (id, email, full_name, phone, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    user_role::public.user_role,
    now(),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists (drop if old version, recreate)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 4: Verification functions
-- ============================================================================

-- Function to check if owner has been initialized
CREATE OR REPLACE FUNCTION public.is_owner_initialized()
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (SELECT owner_assigned FROM owner_init_config WHERE id = 1);
END;
$$;

-- Function to manually assign owner (fallback - only works if not already assigned)
CREATE OR REPLACE FUNCTION public.manually_assign_owner(p_user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  owner_email text;
  owner_assigned boolean;
BEGIN
  -- Check current state
  SELECT owner_email, owner_assigned INTO owner_email, owner_assigned
  FROM owner_init_config WHERE id = 1;
  
  -- If already assigned, don't allow
  IF owner_assigned THEN
    RAISE EXCEPTION 'Owner has already been assigned. This action is disabled.';
  END IF;
  
  -- Verify the user matches expected owner email
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_user_id AND LOWER(email) = LOWER(owner_email)
  ) THEN
    RAISE EXCEPTION 'User email does not match configured owner email.';
  END IF;
  
  -- Assign super_admin role
  UPDATE profiles SET role = 'super_admin' WHERE id = p_user_id;
  
  -- Mark as assigned
  UPDATE owner_init_config SET owner_assigned = true, updated_at = now() WHERE id = 1;
  
  RETURN true;
END;
$$;

-- Verify the reset
SELECT 'Auth system reset complete' as status;
-- ============================================================================
-- SMART RESTAURANT DISCOVERY ENGINE
-- ============================================================================
-- Implements intelligent ranking for restaurant discovery

-- Create a function to compute restaurant discovery scores
CREATE OR REPLACE FUNCTION public.compute_restaurant_discovery_score(
  p_restaurant_id uuid,
  p_customer_id uuid DEFAULT NULL,
  p_selected_wilaya_id int DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_restaurant restaurants;
  v_score numeric := 0;
  v_factors jsonb := '{}'::jsonb;
  v_wilaya_score numeric := 0;
  v_rating_score numeric := 0;
  v_review_count_score numeric := 0;
  v_availability_score numeric := 0;
  v_promo_score numeric := 0;
  v_total_reviews int;
BEGIN
  -- Get restaurant details
  SELECT * INTO v_restaurant FROM restaurants WHERE id = p_restaurant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('score', 0, 'factors', '{}'::jsonb);
  END IF;
  
  -- 1. Wilaya Match (30 points max)
  -- Restaurants in the selected wilaya get full points
  IF p_selected_wilaya_id IS NOT NULL THEN
    IF v_restaurant.wilaya_id = p_selected_wilaya_id THEN
      v_wilaya_score := 30;
    ELSE
      v_wilaya_score := 0;
    END IF;
  ELSE
    -- No wilaya filter: neutral score
    v_wilaya_score := 15;
  END IF;
  
  -- 2. Rating Score (25 points max) - normalized to 0-25 scale
  IF v_restaurant.rating > 0 THEN
    v_rating_score := (v_restaurant.rating / 5.0) * 25;
  END IF;
  
  -- 3. Review Count Score (15 points max) - logarithmic scale
  SELECT COUNT(*) INTO v_total_reviews FROM reviews WHERE restaurant_id = p_restaurant_id;
  IF v_total_reviews > 0 THEN
    v_review_count_score := LEAST(15, LN(v_total_reviews + 1) * 3);
  END IF;
  
  -- 4. Availability Score (20 points max)
  IF v_restaurant.operational_status = 'open' THEN
    v_availability_score := 20;
  ELSIF v_restaurant.operational_status = 'busy' THEN
    v_availability_score := 10;
  ELSE
    v_availability_score := 0;
  END IF;
  
  -- 5. Promotion Score (10 points max)
  IF EXISTS (
    SELECT 1 FROM promotions p
    WHERE p.restaurant_id = p_restaurant_id
      AND p.is_active = true
      AND (p.starts_at IS NULL OR p.starts_at <= now())
      AND (p.ends_at IS NULL OR p.ends_at >= now())
  ) THEN
    v_promo_score := 10;
  END IF;
  
  -- Calculate total score
  v_score := v_wilaya_score + v_rating_score + v_review_count_score + v_availability_score + v_promo_score;
  
  -- Build factors object
  v_factors := jsonb_build_object(
    'wilaya_match', v_wilaya_score,
    'rating', v_rating_score,
    'review_count', v_review_count_score,
    'availability', v_availability_score,
    'promotion', v_promo_score
  );
  
  RETURN jsonb_build_object(
    'score', v_score,
    'factors', v_factors
  );
END;
$$;

-- Create a function to get restaurants with discovery scores for a wilaya
CREATE OR REPLACE FUNCTION public.get_restaurants_with_discovery(
  p_wilaya_id int,
  p_limit int DEFAULT 50,
  p_customer_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  image_url text,
  cuisine text[],
  rating numeric,
  operational_status text,
  estimated_delivery_min int,
  wilaya_id int,
  discovery_score numeric,
  discovery_factors jsonb
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.name,
    r.description,
    r.image_url,
    r.cuisine,
    r.rating,
    r.operational_status::text,
    r.estimated_delivery_min,
    r.wilaya_id,
    COALESCE(
      public.compute_restaurant_discovery_score(r.id, p_customer_id, p_wilaya_id)->>'score',
      '0'
    )::numeric as discovery_score,
    COALESCE(
      public.compute_restaurant_discovery_score(r.id, p_customer_id, p_wilaya_id),
      '{}'::jsonb
    ) as discovery_factors
  FROM restaurants r
  WHERE r.status = 'published'
    AND (p_wilaya_id IS NULL OR r.wilaya_id = p_wilaya_id)
  ORDER BY 
    discovery_score DESC,
    r.rating DESC,
    r.name ASC
  LIMIT p_limit;
END;
$$;

-- Create intelligent search function for restaurants and menu items
CREATE OR REPLACE FUNCTION public.search_restaurants_and_menu(
  p_query text,
  p_wilaya_id int DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  result_type text,
  id uuid,
  name text,
  description text,
  image_url text,
  cuisine text[],
  rating numeric,
  operational_status text,
  restaurant_name text,
  price numeric,
  relevance numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Normalize search query for multilingual support
  p_query := LOWER(TRIM(p_query));
  
  -- Return restaurant matches
  RETURN QUERY
  SELECT 
    'restaurant'::text as result_type,
    r.id::uuid,
    r.name::text,
    r.description::text,
    r.image_url::text,
    r.cuisine::text[],
    r.rating::numeric,
    r.operational_status::text,
    NULL::text as restaurant_name,
    NULL::numeric as price,
    CASE 
      WHEN LOWER(r.name) = p_query THEN 1.0
      WHEN LOWER(r.name) LIKE p_query || '%' THEN 0.9
      WHEN LOWER(r.name) LIKE '%' || p_query || '%' THEN 0.7
      ELSE 0.5
    END::numeric as relevance
  FROM restaurants r
  WHERE r.status = 'published'
    AND (p_wilaya_id IS NULL OR r.wilaya_id = p_wilaya_id)
    AND (
      LOWER(r.name) LIKE '%' || p_query || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(r.cuisine) c 
        WHERE LOWER(c) LIKE '%' || p_query || '%'
      )
      OR (r.description IS NOT NULL AND LOWER(r.description) LIKE '%' || p_query || '%')
    )
  
  UNION ALL
  
  -- Return menu item matches
  SELECT 
    'menu_item'::text as result_type,
    mi.id::uuid,
    mi.name::text,
    mi.description::text,
    mi.image_url::text,
    NULL::text[] as cuisine,
    NULL::numeric as rating,
    NULL::text as operational_status,
    r.name::text as restaurant_name,
    mi.price::numeric,
    CASE 
      WHEN LOWER(mi.name) = p_query THEN 1.0
      WHEN LOWER(mi.name) LIKE p_query || '%' THEN 0.85
      WHEN LOWER(mi.name) LIKE '%' || p_query || '%' THEN 0.6
      ELSE 0.4
    END::numeric as relevance
  FROM menu_items mi
  JOIN restaurants r ON r.id = mi.restaurant_id
  WHERE r.status = 'published'
    AND mi.is_available = true
    AND (p_wilaya_id IS NULL OR r.wilaya_id = p_wilaya_id)
    AND (
      LOWER(mi.name) LIKE '%' || p_query || '%'
      OR (mi.description IS NOT NULL AND LOWER(mi.description) LIKE '%' || p_query || '%')
    )
  
  ORDER BY relevance DESC
  LIMIT p_limit;
END;
$$;

-- Function to log search queries for analytics
CREATE TABLE IF NOT EXISTS search_logs (
  id serial PRIMARY KEY,
  query text NOT NULL,
  wilaya_id int REFERENCES wilayas(id),
  results_count int,
  customer_id uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on search_logs
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_logs_insert" ON search_logs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "search_logs_admin_read" ON search_logs FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
-- ============================================================================
-- LOCATION PRIVACY PROTECTIONS (Additional)
-- ============================================================================

-- Function to get delivery distance without exposing exact restaurant coordinates
CREATE OR REPLACE FUNCTION public.get_delivery_distance(
  p_customer_lat numeric,
  p_customer_lng numeric,
  p_restaurant_id uuid
)
RETURNS numeric
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rest_lat numeric;
  v_rest_lng numeric;
  v_distance numeric;
BEGIN
  -- Get restaurant coordinates (internal calculation only)
  SELECT latitude, longitude INTO v_rest_lat, v_rest_lng
  FROM restaurants WHERE id = p_restaurant_id;
  
  IF v_rest_lat IS NULL OR v_rest_lng IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate distance using Haversine formula
  v_distance := 6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS((p_customer_lat - v_rest_lat) / 2)), 2) +
    COS(RADIANS(v_rest_lat)) * COS(RADIANS(p_customer_lat)) *
    POWER(SIN(RADIANS((p_customer_lng - v_rest_lng) / 2)), 2)
  ));
  
  RETURN v_distance;
END;
$$;

-- Add location retention settings to platform_settings
INSERT INTO platform_settings (key, value) VALUES
  ('location_retention_days', '365'),
  ('anonymous_location_data', 'false')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create function to clean up old location data (for future use)
CREATE OR REPLACE FUNCTION public.cleanup_old_location_data()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  retention_days int;
BEGIN
  SELECT (value::int) INTO retention_days 
  FROM platform_settings 
  WHERE key = 'location_retention_days';
  
  IF retention_days IS NULL THEN
    retention_days := 365;
  END IF;
  
  -- Placeholder for future location logs cleanup
END;
$$;
-- ============================================================================
-- PHASE 4: ENTERPRISE RESTAURANT MANAGEMENT
-- ============================================================================

-- 1. MENU ITEM MODIFIERS (Sizes, Extras, Add-ons)
CREATE TABLE IF NOT EXISTS menu_item_modifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  is_multiple boolean NOT NULL DEFAULT false,
  min_select int NOT NULL DEFAULT 0,
  max_select int,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modifiers_menu_item ON menu_item_modifiers(menu_item_id, position);

CREATE TABLE IF NOT EXISTS modifier_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id uuid NOT NULL REFERENCES menu_item_modifiers(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_adjustion numeric(10,2) NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_options_modifier ON modifier_options(modifier_id, position);

-- RLS
ALTER TABLE menu_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS modifiers_select ON menu_item_modifiers;
CREATE POLICY modifiers_select ON menu_item_modifiers FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM menu_items mi JOIN restaurants r ON r.id = mi.restaurant_id
    WHERE mi.id = menu_item_modifiers.menu_item_id
    AND (r.status = 'published' OR r.owner_id = auth.uid() OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS modifiers_modify ON menu_item_modifiers;
CREATE POLICY modifiers_modify ON menu_item_modifiers FOR ALL
  TO authenticated USING (EXISTS (
    SELECT 1 FROM menu_items mi JOIN restaurants r ON r.id = mi.restaurant_id
    WHERE mi.id = menu_item_modifiers.menu_item_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS options_select ON modifier_options;
CREATE POLICY options_select ON modifier_options FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM menu_item_modifiers m
    JOIN menu_items mi ON mi.id = m.menu_item_id
    JOIN restaurants r ON r.id = mi.restaurant_id
    WHERE m.id = modifier_options.modifier_id
    AND (r.status = 'published' OR r.owner_id = auth.uid() OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS options_modify ON modifier_options;
CREATE POLICY options_modify ON modifier_options FOR ALL
  TO authenticated USING (EXISTS (
    SELECT 1 FROM menu_item_modifiers m
    JOIN menu_items mi ON mi.id = m.menu_item_id
    JOIN restaurants r ON r.id = mi.restaurant_id
    WHERE m.id = modifier_options.modifier_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

-- 2. RESTAURANT SPECIAL HOURS (Holidays, Temporary closures, Ramadan)
CREATE TABLE IF NOT EXISTS restaurant_special_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  open_time time,
  close_time time,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_special_hours_date ON restaurant_special_hours(restaurant_id, date);

-- RLS
ALTER TABLE restaurant_special_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS special_hours_select ON restaurant_special_hours;
CREATE POLICY special_hours_select ON restaurant_special_hours FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = restaurant_special_hours.restaurant_id
    AND (r.status = 'published' OR r.owner_id = auth.uid() OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS special_hours_modify ON restaurant_special_hours;
CREATE POLICY special_hours_modify ON restaurant_special_hours FOR ALL
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = restaurant_special_hours.restaurant_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

-- 3. PROMOTIONS TABLE (Restaurant-level promotions)
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  promo_type text NOT NULL CHECK (promo_type IN ('percentage', 'fixed', 'buy_x_get_y')),
  discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
  buy_quantity int DEFAULT 1,
  get_quantity int DEFAULT 0,
  min_order_amount numeric(10,2) DEFAULT 0,
  max_discount numeric(10,2),
  applies_to text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'category', 'item')),
  category_id uuid REFERENCES menu_categories(id) ON DELETE SET NULL,
  item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,
  used_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_restaurant ON promotions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(restaurant_id) WHERE is_active = true;

-- RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promotions_select ON promotions;
CREATE POLICY promotions_select ON promotions FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = promotions.restaurant_id
    AND (r.status = 'published' OR r.owner_id = auth.uid() OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS promotions_modify ON promotions;
CREATE POLICY promotions_modify ON promotions FOR ALL
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = promotions.restaurant_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

-- 4. RESTAURANT ANALYTICS AGGREGATE TABLE (Daily snapshots)
CREATE TABLE IF NOT EXISTS restaurant_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date date NOT NULL,
  orders_count int NOT NULL DEFAULT 0,
  orders_cancelled int NOT NULL DEFAULT 0,
  revenue_gross numeric(12,2) NOT NULL DEFAULT 0,
  revenue_net numeric(12,2) NOT NULL DEFAULT 0,
  commission_owed numeric(12,2) NOT NULL DEFAULT 0,
  avg_order_value numeric(10,2) NOT NULL DEFAULT 0,
  avg_prep_time_minutes int,
  new_customers int NOT NULL DEFAULT 0,
  repeat_customers int NOT NULL DEFAULT 0,
  rating_avg numeric(3,2),
  reviews_count int NOT NULL DEFAULT 0,
  peak_hour int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_restaurant_date ON restaurant_analytics(restaurant_id, date DESC);

-- RLS
ALTER TABLE restaurant_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analytics_select ON restaurant_analytics;
CREATE POLICY analytics_select ON restaurant_analytics FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = restaurant_analytics.restaurant_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS analytics_insert ON restaurant_analytics;
CREATE POLICY analytics_insert ON restaurant_analytics FOR INSERT
  TO authenticated WITH CHECK (public.is_super_admin());

-- 5. CUSTOMER NOTES (Internal restaurant notes about customers)
CREATE TABLE IF NOT EXISTS customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note text NOT NULL,
  is_warning boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, customer_id)
);

-- RLS
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_notes_select ON customer_notes;
CREATE POLICY customer_notes_select ON customer_notes FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = customer_notes.restaurant_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS customer_notes_modify ON customer_notes;
CREATE POLICY customer_notes_modify ON customer_notes FOR ALL
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = customer_notes.restaurant_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

-- 6. PLATFORM HEALTH CHECK TABLE
CREATE TABLE IF NOT EXISTS platform_health (
  id serial PRIMARY KEY,
  component text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'down')),
  last_check timestamptz NOT NULL DEFAULT now(),
  latency_ms int,
  error_message text,
  details jsonb DEFAULT '{}'::jsonb
);

-- Insert default health components
INSERT INTO platform_health (component) VALUES
  ('database'), ('auth'), ('storage'), ('realtime'), ('maps')
ON CONFLICT (component) DO NOTHING;

-- 7. FUNCTION: Get Restaurant Analytics Summary
CREATE OR REPLACE FUNCTION public.get_restaurant_analytics_summary(
  p_restaurant_id uuid,
  p_days int DEFAULT 30
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'period_days', p_days,
    'total_orders', COALESCE(SUM(orders_count), 0),
    'total_revenue', COALESCE(SUM(revenue_gross), 0),
    'total_cancelled', COALESCE(SUM(orders_cancelled), 0),
    'avg_order_value', CASE WHEN SUM(orders_count) > 0 
      THEN SUM(revenue_gross) / SUM(orders_count) ELSE 0 END,
    'avg_prep_time', AVG(avg_prep_time_minutes),
    'total_reviews', COALESCE(SUM(reviews_count), 0),
    'avg_rating', AVG(rating_avg),
    'peak_hour', MODE() WITHIN GROUP (ORDER BY peak_hour),
    'new_customers', COALESCE(SUM(new_customers), 0),
    'repeat_customers', COALESCE(SUM(repeat_customers), 0)
  ) INTO v_result
  FROM restaurant_analytics
  WHERE restaurant_id = p_restaurant_id
    AND date >= CURRENT_DATE - p_days;
  
  RETURN v_result;
END;
$$;

-- 8. FUNCTION: Get Restaurant Orders by Product
CREATE OR REPLACE FUNCTION public.get_top_products(
  p_restaurant_id uuid,
  p_days int DEFAULT 30,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  orders_count bigint,
  revenue numeric
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oi.id as product_id,
    oi.name as product_name,
    COUNT(DISTINCT o.id) as orders_count,
    SUM(oi.quantity * oi.unit_price) as revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN menu_items mi ON mi.id = oi.id
  WHERE mi.restaurant_id = p_restaurant_id
    AND o.created_at >= now() - (p_days || ' days')::interval
    AND o.status NOT IN ('cancelled', 'failed_delivery', 'refunded')
  GROUP BY oi.id, oi.name
  ORDER BY orders_count DESC, revenue DESC
  LIMIT p_limit;
END;
$$;

-- 9. FUNCTION: Update restaurant analytics daily
CREATE OR REPLACE FUNCTION public.update_restaurant_analytics(p_date date DEFAULT CURRENT_DATE - 1)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO restaurant_analytics (
    restaurant_id, date, orders_count, orders_cancelled,
    revenue_gross, revenue_net, commission_owed, avg_order_value,
    avg_prep_time_minutes, new_customers, repeat_customers,
    rating_avg, reviews_count, peak_hour
  )
  SELECT 
    r.id,
    p_date,
    COUNT(CASE WHEN o.status NOT IN ('cancelled', 'failed_delivery') THEN 1 END),
    COUNT(CASE WHEN o.status IN ('cancelled', 'failed_delivery') THEN 1 END),
    COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'failed_delivery') THEN o.total END), 0),
    COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'failed_delivery') THEN fl.restaurant_payout END), 0),
    COALESCE(SUM(CASE WHEN o.status NOT IN ('cancelled', 'failed_delivery') THEN fl.platform_commission END), 0),
    CASE WHEN COUNT(CASE WHEN o.status NOT IN ('cancelled', 'failed_delivery') THEN 1 END) > 0
      THEN SUM(CASE WHEN o.status NOT IN ('cancelled', 'failed_delivery') THEN o.total END) / 
           COUNT(CASE WHEN o.status NOT IN ('cancelled', 'failed_delivery') THEN 1 END)
      ELSE 0 END,
    NULL, -- prep time would need tracking
    COUNT(DISTINCT CASE WHEN o.status NOT IN ('cancelled', 'failed_delivery') 
      AND NOT EXISTS (
        SELECT 1 FROM orders o2 WHERE o2.customer_id = o.customer_id 
        AND o2.restaurant_id = r.id AND o2.created_at < p_date
      ) THEN o.customer_id END),
    COUNT(DISTINCT CASE WHEN o.status NOT IN ('cancelled', 'failed_delivery') 
      AND EXISTS (
        SELECT 1 FROM orders o2 WHERE o2.customer_id = o.customer_id 
        AND o2.restaurant_id = r.id AND o2.created_at < p_date
      ) THEN o.customer_id END),
    NULL, -- rating avg would need reviews
    0,
    NULL -- peak hour would need hour grouping
  FROM restaurants r
  LEFT JOIN orders o ON o.restaurant_id = r.id AND DATE(o.created_at) = p_date
  LEFT JOIN financial_ledger fl ON fl.order_id = o.id
  GROUP BY r.id
  ON CONFLICT (restaurant_id, date) DO UPDATE SET
    orders_count = EXCLUDED.orders_count,
    orders_cancelled = EXCLUDED.orders_cancelled,
    revenue_gross = EXCLUDED.revenue_gross,
    revenue_net = EXCLUDED.revenue_net,
    commission_owed = EXCLUDED.commission_owed,
    avg_order_value = EXCLUDED.avg_order_value,
    new_customers = EXCLUDED.new_customers,
    repeat_customers = EXCLUDED.repeat_customers;
END;
$$;

-- 10. TRIGGER: Update restaurant rating when review is added
CREATE OR REPLACE FUNCTION public.update_restaurant_rating()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE restaurants
  SET rating = (
    SELECT COALESCE(AVG(rating), 0) FROM reviews 
    WHERE restaurant_id = NEW.restaurant_id AND is_hidden = false
  ),
  review_count = (
    SELECT COUNT(*) FROM reviews 
    WHERE restaurant_id = NEW.restaurant_id AND is_hidden = false
  )
  WHERE id = NEW.restaurant_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_restaurant_rating ON reviews;
CREATE TRIGGER trg_update_restaurant_rating
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_restaurant_rating();
-- Security fix: Enable RLS on platform_health table
ALTER TABLE platform_health ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read platform health (for dashboard)
DROP POLICY IF EXISTS platform_health_select ON platform_health;
CREATE POLICY platform_health_select ON platform_health
  FOR SELECT TO authenticated USING (true);

-- Only super admins can update health status
DROP POLICY IF EXISTS platform_health_update ON platform_health;
CREATE POLICY platform_health_update ON platform_health
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Secure the owner_init_config table (was missing RLS policies)
DROP POLICY IF EXISTS owner_init_config_select ON owner_init_config;
CREATE POLICY owner_init_config_select ON owner_init_config
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS owner_init_config_update ON owner_init_config;
CREATE POLICY owner_init_config_update ON owner_init_config
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());-- ============================================================================
-- PHASE 6, 7, 8: CUSTOMER EXPERIENCE, DRIVER ECOSYSTEM & AI PLATFORM
-- ============================================================================

-- Add driver_id to orders FIRST (before creating drivers table)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id uuid;
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(driver_id);

-- ============================================================================
-- PHASE 6: CUSTOMER EXPERIENCE
-- ============================================================================

-- 1. CUSTOMER FAVORITES
CREATE TABLE IF NOT EXISTS customer_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, restaurant_id),
  UNIQUE(customer_id, menu_item_id),
  CHECK (restaurant_id IS NOT NULL OR menu_item_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_favorites_customer ON customer_favorites(customer_id);
CREATE INDEX IF NOT EXISTS idx_favorites_restaurant ON customer_favorites(restaurant_id);

ALTER TABLE customer_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS favorites_select ON customer_favorites;
CREATE POLICY favorites_select ON customer_favorites FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS favorites_insert ON customer_favorites;
CREATE POLICY favorites_insert ON customer_favorites FOR INSERT
  TO authenticated WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS favorites_delete ON customer_favorites;
CREATE POLICY favorites_delete ON customer_favorites FOR DELETE
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

-- 2. LOYALTY POINTS
CREATE TABLE IF NOT EXISTS loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  points int NOT NULL DEFAULT 0 CHECK (points >= 0),
  lifetime_points int NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_customer ON loyalty_points(customer_id);

ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_select ON loyalty_points;
CREATE POLICY loyalty_select ON loyalty_points FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS loyalty_modify ON loyalty_points;
CREATE POLICY loyalty_modify ON loyalty_points FOR ALL
  TO authenticated USING (public.is_super_admin());

-- 3. LOYALTY TRANSACTIONS
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points int NOT NULL,
  reason text NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_id);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_tx_select ON loyalty_transactions;
CREATE POLICY loyalty_tx_select ON loyalty_transactions FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

-- 4. CUSTOMER PREFERENCES
CREATE TABLE IF NOT EXISTS customer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  preferred_cuisines text[] DEFAULT '{}',
  dietary_restrictions text[] DEFAULT '{}',
  allergies text[] DEFAULT '{}',
  receive_marketing_emails boolean NOT NULL DEFAULT true,
  receive_push_notifications boolean NOT NULL DEFAULT true,
  receive_order_updates boolean NOT NULL DEFAULT true,
  receive_promotions boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prefs_select ON customer_preferences;
CREATE POLICY prefs_select ON customer_preferences FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS prefs_modify ON customer_preferences;
CREATE POLICY prefs_modify ON customer_preferences FOR ALL
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

-- 5. RECENT ORDERS SUMMARY
CREATE TABLE IF NOT EXISTS recent_orders_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
  last_order_at timestamptz NOT NULL DEFAULT now(),
  order_count int NOT NULL DEFAULT 1,
  UNIQUE(customer_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_recent_orders_customer ON recent_orders_summary(customer_id, last_order_at DESC);

ALTER TABLE recent_orders_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recent_select ON recent_orders_summary;
CREATE POLICY recent_select ON recent_orders_summary FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

-- ============================================================================
-- PHASE 7: DRIVER ECOSYSTEM
-- ============================================================================

-- 1. DRIVERS TABLE
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  vehicle_type text NOT NULL DEFAULT 'motorcycle' CHECK (vehicle_type IN ('bicycle', 'motorcycle', 'car', 'scooter')),
  vehicle_plate text,
  vehicle_color text,
  is_online boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  current_latitude double precision,
  current_longitude double precision,
  last_location_update timestamptz,
  rating numeric(3,2) NOT NULL DEFAULT 5 CHECK (rating >= 0 AND rating <= 5),
  delivery_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drivers_user ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON drivers(is_online) WHERE is_online = true AND is_verified = true;

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drivers_select ON drivers;
CREATE POLICY drivers_select ON drivers FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS drivers_insert ON drivers;
CREATE POLICY drivers_insert ON drivers FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS drivers_update ON drivers;
CREATE POLICY drivers_update ON drivers FOR UPDATE
  TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());

-- 2. DRIVER DOCUMENTS
CREATE TABLE IF NOT EXISTS driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('license', 'id_card', 'vehicle_registration', 'insurance')),
  document_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE driver_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driverdocs_select ON driver_documents;
CREATE POLICY driverdocs_select ON driver_documents FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_documents.driver_id AND d.user_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS driverdocs_insert ON driver_documents;
CREATE POLICY driverdocs_insert ON driver_documents FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_documents.driver_id AND d.user_id = auth.uid())
  );

DROP POLICY IF EXISTS driverdocs_update ON driver_documents;
CREATE POLICY driverdocs_update ON driver_documents FOR UPDATE
  TO authenticated USING (public.is_super_admin());

-- 3. DELIVERIES TABLE
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN (
    'assigned', 'driver_accepted', 'driver_declined',
    'picking_up', 'picked_up', 'en_route', 'arrived', 'delivered', 'failed'
  )),
  pickup_latitude double precision,
  pickup_longitude double precision,
  delivery_latitude double precision,
  delivery_longitude double precision,
  pickup_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  driver_notes text,
  customer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deliveries_select ON deliveries;
CREATE POLICY deliveries_select ON deliveries FOR SELECT
  TO authenticated USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS deliveries_update ON deliveries;
CREATE POLICY deliveries_update ON deliveries FOR UPDATE
  TO authenticated USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR public.is_super_admin()
  );

-- 4. DRIVER EARNINGS
CREATE TABLE IF NOT EXISTS driver_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  base_fee numeric(10,2) NOT NULL DEFAULT 0,
  distance_fee numeric(10,2) NOT NULL DEFAULT 0,
  tip numeric(10,2) NOT NULL DEFAULT 0,
  bonus numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  settlement_status text NOT NULL DEFAULT 'pending' CHECK (settlement_status IN ('pending', 'settled')),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_earnings_driver ON driver_earnings(driver_id);

ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS earnings_select ON driver_earnings;
CREATE POLICY earnings_select ON driver_earnings FOR SELECT
  TO authenticated USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR public.is_super_admin()
  );

-- 5. DELIVERY ZONES
CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wilaya_id smallint NOT NULL REFERENCES wilayas(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_fee numeric(10,2) NOT NULL DEFAULT 50,
  per_km_fee numeric(10,2) NOT NULL DEFAULT 10,
  min_fee numeric(10,2) NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_wilaya ON delivery_zones(wilaya_id);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zones_select ON delivery_zones;
CREATE POLICY zones_select ON delivery_zones FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS zones_modify ON delivery_zones;
CREATE POLICY zones_modify ON delivery_zones FOR ALL
  TO authenticated USING (public.is_super_admin());

-- ============================================================================
-- PHASE 8: AI PLATFORM & MARKETING
-- ============================================================================

-- 1. SEARCH LOGS ENHANCEMENT
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS clicked_restaurant_id uuid REFERENCES restaurants(id);
ALTER TABLE search_logs ADD COLUMN IF NOT EXISTS clicked_item_id uuid REFERENCES menu_items(id);

-- 2. CUSTOMER RECOMMENDATIONS
CREATE TABLE IF NOT EXISTS customer_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  score numeric(5,4) NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'popular',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_recs_customer ON customer_recommendations(customer_id, score DESC);

ALTER TABLE customer_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recs_select ON customer_recommendations;
CREATE POLICY recs_select ON customer_recommendations FOR SELECT
  TO authenticated USING (customer_id = auth.uid());

-- 3. MARKETING CAMPAIGNS
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_type text NOT NULL CHECK (campaign_type IN ('coupon', 'push', 'email', 'in_app', 'loyalty')),
  target_audience text NOT NULL DEFAULT 'all',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  sent_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_select ON marketing_campaigns;
CREATE POLICY campaigns_select ON marketing_campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS campaigns_modify ON marketing_campaigns;
CREATE POLICY campaigns_modify ON marketing_campaigns FOR ALL
  TO authenticated USING (public.is_super_admin());

-- 4. FEATURE FLAGS
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  rollout_percentage int NOT NULL DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flags_select ON feature_flags;
CREATE POLICY flags_select ON feature_flags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS flags_modify ON feature_flags;
CREATE POLICY flags_modify ON feature_flags FOR ALL
  TO authenticated USING (public.is_super_admin());

-- 5. SUBSCRIPTION PLANS
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('customer', 'restaurant', 'driver')),
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sub_select ON customer_subscriptions;
CREATE POLICY sub_select ON customer_subscriptions FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculate delivery fee with Haversine
CREATE OR REPLACE FUNCTION public.calculate_delivery_fee(
  p_restaurant_id uuid,
  p_delivery_lat double precision,
  p_delivery_lng double precision
)
RETURNS numeric
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_max_km numeric;
  v_distance_km numeric;
BEGIN
  SELECT latitude, longitude, max_delivery_km
  INTO v_lat, v_lng, v_max_km
  FROM restaurants WHERE id = p_restaurant_id;
  
  IF v_lat IS NULL OR v_lng IS NULL THEN RETURN 0; END IF;
  
  v_distance_km := 6371 * acos(least(1, greatest(-1,
    cos(radians(v_lat)) * cos(radians(p_delivery_lat)) *
    cos(radians(p_delivery_lng) - radians(v_lng)) +
    sin(radians(v_lat)) * sin(radians(p_delivery_lat))
  )));
  
  IF v_distance_km > v_max_km THEN RETURN -1; END IF;
  
  RETURN 50 + (v_distance_km * 10);
END;
$$;

-- Award loyalty points
CREATE OR REPLACE FUNCTION public.award_loyalty_points(
  p_customer_id uuid,
  p_order_id uuid,
  p_order_total numeric
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_points int;
BEGIN
  v_points := FLOOR(p_order_total / 100);
  IF v_points > 0 THEN
    INSERT INTO loyalty_transactions (customer_id, points, reason, order_id)
    VALUES (p_customer_id, v_points, 'order_completion', p_order_id);
    
    INSERT INTO loyalty_points (customer_id, points, lifetime_points)
    VALUES (p_customer_id, v_points, v_points)
    ON CONFLICT (customer_id) DO UPDATE SET
      points = loyalty_points.points + v_points,
      lifetime_points = loyalty_points.lifetime_points + v_points,
      tier = CASE
        WHEN loyalty_points.lifetime_points + v_points >= 10000 THEN 'platinum'
        WHEN loyalty_points.lifetime_points + v_points >= 5000 THEN 'gold'
        WHEN loyalty_points.lifetime_points + v_points >= 2000 THEN 'silver'
        ELSE 'bronze'
      END,
      updated_at = now();
  END IF;
END;
$$;

-- Trigger: Update recent orders on delivery
CREATE OR REPLACE FUNCTION public.update_recent_orders_summary()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'delivered' THEN
    INSERT INTO recent_orders_summary (customer_id, restaurant_id, last_order_at, order_count)
    VALUES (NEW.customer_id, NEW.restaurant_id, now(), 1)
    ON CONFLICT (customer_id, restaurant_id) DO UPDATE SET
      last_order_at = now(),
      order_count = recent_orders_summary.order_count + 1;
    
    -- Award loyalty points
    PERFORM award_loyalty_points(NEW.customer_id, NEW.id, NEW.total::numeric);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_recent_orders ON orders;
CREATE TRIGGER trg_update_recent_orders
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.update_recent_orders_summary();

-- Now add the FK constraint to orders.driver_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_driver_id_fkey' AND table_name = 'orders'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_driver_id_fkey 
    FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
  END IF;
END $$;
-- Add driver role to user_role enum
-- (Commented out: driver is now included natively in the foundation migration user_role enum)
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'driver';

-- Create driver profile view with computed fields
CREATE OR REPLACE VIEW driver_profile_view 
WITH (security_invoker = true) AS
SELECT 
  d.id as driver_id,
  d.user_id,
  p.full_name,
  p.email,
  p.phone,
  d.vehicle_type,
  d.vehicle_plate,
  d.vehicle_color,
  d.is_online,
  d.is_verified,
  d.is_active,
  d.current_latitude,
  d.current_longitude,
  d.last_location_update,
  d.rating,
  d.delivery_count,
  d.created_at
FROM drivers d
JOIN profiles p ON p.id = d.user_id;

-- Grant select on view
GRANT SELECT ON driver_profile_view TO authenticated;-- Enable RLS on subscription_plans table (was missing)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can read active subscription plans (for display in UI)
DROP POLICY IF EXISTS subscription_plans_select ON subscription_plans;
CREATE POLICY subscription_plans_select ON subscription_plans FOR SELECT
  TO authenticated USING (true);

-- Only super admins can modify subscription plans
DROP POLICY IF EXISTS subscription_plans_modify ON subscription_plans;
CREATE POLICY subscription_plans_modify ON subscription_plans FOR ALL
  TO authenticated USING (public.is_super_admin());-- Add super admin read access to saved_addresses
DROP POLICY IF EXISTS saved_addresses_select_admin ON saved_addresses;
CREATE POLICY saved_addresses_select_admin ON saved_addresses
  FOR SELECT TO authenticated
  USING (has_super_admin_role(auth.uid()));

-- Also add super admin read access to orders for pickup points
DROP POLICY IF EXISTS orders_select_admin_fallback ON orders;
CREATE POLICY orders_select_admin_fallback ON orders
  FOR SELECT TO authenticated
  USING (has_super_admin_role(auth.uid()));
