-- ============================================================================
-- KIYO FOUNDATION SCHEMA (Phase 1)
-- Tables: profiles, restaurants, orders, order_items, audit_logs
-- RLS: customers see only own data; restaurants see only own; admin = all
-- Helper functions hardened with explicit search_path; EXECUTE revoked from anon
-- ============================================================================

-- ---------- ENUMS ----------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'restaurant_owner', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
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
CREATE INDEX IF NOT EXISTS idx_restaurants_active ON restaurants(is_active) WHERE is_active = true;

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
  SELECT id FROM profiles WHERE email = 'abdeljalilaldjaber@gmail.com' INTO v_uid;
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
    CASE WHEN NEW.email = 'abdeljalilaldjaber@gmail.com' THEN 'super_admin'::user_role
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
CREATE POLICY profiles_select_own_or_admin ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_super_admin());

CREATE POLICY profiles_insert_self ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_admin ON profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- RESTAURANTS
CREATE POLICY restaurants_select_visible ON restaurants
  FOR SELECT TO authenticated
  USING (is_active = true OR owner_id = auth.uid() OR public.is_super_admin());

CREATE POLICY restaurants_insert_owner_or_admin ON restaurants
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());

CREATE POLICY restaurants_update_owner_or_admin ON restaurants
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (owner_id = auth.uid() OR public.is_super_admin());

CREATE POLICY restaurants_delete_owner_or_admin ON restaurants
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin());

-- ORDERS
CREATE POLICY orders_select_scoped ON orders
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR restaurant_id = public.get_user_restaurant_id()
    OR public.is_super_admin()
  );

CREATE POLICY orders_insert_customer ON orders
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

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

CREATE POLICY orders_delete_customer_pending ON orders
  FOR DELETE TO authenticated
  USING (customer_id = auth.uid() AND status = 'pending');

-- ORDER ITEMS
CREATE POLICY order_items_select_scoped ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id
      AND (o.customer_id = auth.uid() OR o.restaurant_id = public.get_user_restaurant_id() OR public.is_super_admin()))
  );

CREATE POLICY order_items_insert_customer ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.customer_id = auth.uid())
  );

CREATE POLICY order_items_delete_via_order ON order_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id
      AND (o.customer_id = auth.uid() OR o.restaurant_id = public.get_user_restaurant_id() OR public.is_super_admin()))
  );

-- AUDIT LOGS — admin read only; writes go via log_activity()
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
