-- ============================================================================
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

CREATE POLICY favorites_select ON customer_favorites FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

CREATE POLICY favorites_insert ON customer_favorites FOR INSERT
  TO authenticated WITH CHECK (customer_id = auth.uid());

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

CREATE POLICY loyalty_select ON loyalty_points FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

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

CREATE POLICY prefs_select ON customer_preferences FOR SELECT
  TO authenticated USING (customer_id = auth.uid() OR public.is_super_admin());

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

CREATE POLICY drivers_select ON drivers FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY drivers_insert ON drivers FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

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

CREATE POLICY driverdocs_select ON driver_documents FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_documents.driver_id AND d.user_id = auth.uid())
    OR public.is_super_admin()
  );

CREATE POLICY driverdocs_insert ON driver_documents FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM drivers d WHERE d.id = driver_documents.driver_id AND d.user_id = auth.uid())
  );

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

CREATE POLICY deliveries_select ON deliveries FOR SELECT
  TO authenticated USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
    OR order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
    OR public.is_super_admin()
  );

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

CREATE POLICY zones_select ON delivery_zones FOR SELECT TO authenticated USING (true);
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

CREATE POLICY campaigns_select ON marketing_campaigns FOR SELECT TO authenticated USING (true);
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

CREATE POLICY flags_select ON feature_flags FOR SELECT TO authenticated USING (true);
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
