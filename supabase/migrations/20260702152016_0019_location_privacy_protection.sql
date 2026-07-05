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
