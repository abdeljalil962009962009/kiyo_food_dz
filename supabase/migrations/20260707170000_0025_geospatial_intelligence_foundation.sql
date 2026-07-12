-- KIYO FOOD Phase 25: Geospatial intelligence foundation
-- Adds PostGIS-backed location columns, indexes, and reusable server-side
-- functions for restaurant discovery, delivery validation, and suspicious
-- driver movement checks.

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Algeria',
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Africa/Algiers',
  ADD COLUMN IF NOT EXISTS geohash text,
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS location_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo geography(Point, 4326);

ALTER TABLE saved_addresses
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS commune text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Algeria',
  ADD COLUMN IF NOT EXISTS geohash text,
  ADD COLUMN IF NOT EXISTS accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo geography(Point, 4326);

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS heading numeric,
  ADD COLUMN IF NOT EXISTS speed_mps numeric,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz,
  ADD COLUMN IF NOT EXISTS geo geography(Point, 4326);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS delivery_geo geography(Point, 4326);

CREATE INDEX IF NOT EXISTS idx_restaurants_geo ON restaurants USING gist (geo);
CREATE INDEX IF NOT EXISTS idx_restaurants_geohash ON restaurants (geohash);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_geo ON saved_addresses USING gist (geo);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_customer_recent ON saved_addresses (customer_id, is_archived, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_drivers_geo ON drivers USING gist (geo);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_geo ON orders USING gist (delivery_geo);

CREATE OR REPLACE FUNCTION public.kiyo_sync_restaurant_geo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
    NEW.location_updated_at := COALESCE(NEW.location_updated_at, now());
  ELSE
    NEW.geo := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kiyo_sync_restaurant_geo ON restaurants;
CREATE TRIGGER trg_kiyo_sync_restaurant_geo
BEFORE INSERT OR UPDATE OF latitude, longitude, location_updated_at ON restaurants
FOR EACH ROW EXECUTE FUNCTION public.kiyo_sync_restaurant_geo();

CREATE OR REPLACE FUNCTION public.kiyo_sync_saved_address_geo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  ELSE
    NEW.geo := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kiyo_sync_saved_address_geo ON saved_addresses;
CREATE TRIGGER trg_kiyo_sync_saved_address_geo
BEFORE INSERT OR UPDATE OF latitude, longitude ON saved_addresses
FOR EACH ROW EXECUTE FUNCTION public.kiyo_sync_saved_address_geo();

CREATE OR REPLACE FUNCTION public.kiyo_sync_driver_geo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.current_latitude IS NOT NULL AND NEW.current_longitude IS NOT NULL THEN
    NEW.geo := ST_SetSRID(ST_MakePoint(NEW.current_longitude, NEW.current_latitude), 4326)::geography;
    NEW.last_location_at := COALESCE(NEW.last_location_at, now());
  ELSE
    NEW.geo := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kiyo_sync_driver_geo ON drivers;
CREATE TRIGGER trg_kiyo_sync_driver_geo
BEFORE INSERT OR UPDATE OF current_latitude, current_longitude, last_location_at ON drivers
FOR EACH ROW EXECUTE FUNCTION public.kiyo_sync_driver_geo();

CREATE OR REPLACE FUNCTION public.kiyo_sync_order_delivery_geo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.delivery_latitude IS NOT NULL AND NEW.delivery_longitude IS NOT NULL THEN
    NEW.delivery_geo := ST_SetSRID(ST_MakePoint(NEW.delivery_longitude, NEW.delivery_latitude), 4326)::geography;
  ELSE
    NEW.delivery_geo := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kiyo_sync_order_delivery_geo ON orders;
CREATE TRIGGER trg_kiyo_sync_order_delivery_geo
BEFORE INSERT OR UPDATE OF delivery_latitude, delivery_longitude ON orders
FOR EACH ROW EXECUTE FUNCTION public.kiyo_sync_order_delivery_geo();

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
  FROM restaurants r, origin
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
  v_restaurant restaurants%ROWTYPE;
  v_origin geography(Point, 4326);
  v_destination geography(Point, 4326);
  v_distance_km numeric;
  v_max_km numeric;
  v_finance jsonb;
BEGIN
  SELECT * INTO v_restaurant FROM restaurants WHERE id = p_restaurant_id;
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

CREATE OR REPLACE FUNCTION public.detect_suspicious_driver_location(
  p_driver_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_recorded_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_driver drivers%ROWTYPE;
  v_new_geo geography(Point, 4326);
  v_distance_m numeric;
  v_seconds numeric;
  v_speed_mps numeric;
BEGIN
  SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;
  IF NOT FOUND OR v_driver.geo IS NULL OR v_driver.last_location_at IS NULL THEN
    RETURN jsonb_build_object('suspicious', false, 'reason', 'insufficient_history');
  END IF;

  v_new_geo := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_distance_m := ST_Distance(v_driver.geo, v_new_geo);
  v_seconds := GREATEST(EXTRACT(EPOCH FROM (p_recorded_at - v_driver.last_location_at)), 1);
  v_speed_mps := v_distance_m / v_seconds;

  RETURN jsonb_build_object(
    'suspicious', v_speed_mps > 45,
    'reason', CASE WHEN v_speed_mps > 45 THEN 'impossible_speed' ELSE 'normal' END,
    'distance_m', ROUND(v_distance_m, 1),
    'seconds', ROUND(v_seconds, 1),
    'speed_mps', ROUND(v_speed_mps, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_restaurants(double precision, double precision, numeric, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_delivery_location(uuid, double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_driver_location(uuid, double precision, double precision, timestamptz) TO authenticated;
