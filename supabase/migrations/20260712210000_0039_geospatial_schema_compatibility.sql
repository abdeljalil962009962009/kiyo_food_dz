-- Repair early geospatial functions to use the canonical restaurant schema.
-- Migration 0025 originally referenced prototype column names that never became
-- part of the production restaurant table.

BEGIN;

CREATE OR REPLACE FUNCTION public.nearby_restaurants(
  p_lat double precision,
  p_lng double precision,
  p_radius_km numeric DEFAULT 10,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text,
  cuisine_type text,
  rating numeric,
  review_count integer,
  delivery_fee numeric,
  min_order numeric,
  max_delivery_km numeric,
  is_open boolean,
  latitude double precision,
  longitude double precision,
  distance_km numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH origin AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS geo
  )
  SELECT
    r.id,
    r.name,
    r.image_url AS logo_url,
    array_to_string(r.cuisine, ', ') AS cuisine_type,
    r.rating,
    r.review_count,
    0::numeric AS delivery_fee,
    r.min_order_amount AS min_order,
    r.max_delivery_km,
    (r.operational_status = 'open') AS is_open,
    r.latitude,
    r.longitude,
    ROUND((ST_Distance(r.geo, origin.geo) / 1000)::numeric, 2) AS distance_km
  FROM public.restaurants r, origin
  WHERE r.geo IS NOT NULL
    AND r.status = 'published'
    AND ST_DWithin(r.geo, origin.geo, GREATEST(p_radius_km, 0) * 1000)
  ORDER BY r.geo <-> origin.geo
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

CREATE OR REPLACE FUNCTION public.validate_delivery_location(
  p_restaurant_id uuid,
  p_lat double precision,
  p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_origin geography(Point, 4326);
  v_destination geography(Point, 4326);
  v_distance_km numeric;
  v_max_km numeric;
  v_finance jsonb;
BEGIN
  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = p_restaurant_id;

  IF NOT FOUND OR v_restaurant.geo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'restaurant_location_missing');
  END IF;

  v_origin := v_restaurant.geo;
  v_destination := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_distance_km := ROUND((ST_Distance(v_origin, v_destination) / 1000)::numeric, 2);
  v_max_km := COALESCE(v_restaurant.max_delivery_km, 10);
  v_finance := public.calculate_order_financials('[]'::jsonb, v_distance_km)::jsonb;

  RETURN jsonb_build_object(
    'ok', v_distance_km <= v_max_km,
    'distance_km', v_distance_km,
    'max_delivery_km', v_max_km,
    'delivery_fee', COALESCE((v_finance->>'delivery_fee')::numeric, 0),
    'reason', CASE WHEN v_distance_km <= v_max_km THEN 'inside_zone' ELSE 'outside_zone' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_restaurants(double precision, double precision, numeric, integer)
  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_delivery_location(uuid, double precision, double precision)
  TO authenticated;

COMMIT;
