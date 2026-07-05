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
