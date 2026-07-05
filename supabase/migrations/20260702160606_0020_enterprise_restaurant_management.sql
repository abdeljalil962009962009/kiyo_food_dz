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

CREATE POLICY modifiers_select ON menu_item_modifiers FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM menu_items mi JOIN restaurants r ON r.id = mi.restaurant_id
    WHERE mi.id = menu_item_modifiers.menu_item_id
    AND (r.status = 'published' OR r.owner_id = auth.uid() OR public.is_super_admin())
  ));

CREATE POLICY modifiers_modify ON menu_item_modifiers FOR ALL
  TO authenticated USING (EXISTS (
    SELECT 1 FROM menu_items mi JOIN restaurants r ON r.id = mi.restaurant_id
    WHERE mi.id = menu_item_modifiers.menu_item_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

CREATE POLICY options_select ON modifier_options FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM menu_item_modifiers m
    JOIN menu_items mi ON mi.id = m.menu_item_id
    JOIN restaurants r ON r.id = mi.restaurant_id
    WHERE m.id = modifier_options.modifier_id
    AND (r.status = 'published' OR r.owner_id = auth.uid() OR public.is_super_admin())
  ));

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

CREATE POLICY special_hours_select ON restaurant_special_hours FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = restaurant_special_hours.restaurant_id
    AND (r.status = 'published' OR r.owner_id = auth.uid() OR public.is_super_admin())
  ));

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

CREATE POLICY promotions_select ON promotions FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = promotions.restaurant_id
    AND (r.status = 'published' OR r.owner_id = auth.uid() OR public.is_super_admin())
  ));

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

CREATE POLICY analytics_select ON restaurant_analytics FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = restaurant_analytics.restaurant_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

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

CREATE POLICY customer_notes_select ON customer_notes FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM restaurants r WHERE r.id = customer_notes.restaurant_id
    AND (r.owner_id = auth.uid() OR public.is_super_admin())
  ));

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
