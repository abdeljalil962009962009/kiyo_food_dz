-- KIYO FOOD Phase 26: production driver live-location writes
-- Stores driver GPS events and exposes one authenticated RPC that validates
-- ownership, calculates suspicious movement, and updates the driver's current
-- position atomically.

CREATE TABLE IF NOT EXISTS driver_location_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m numeric CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  heading numeric CHECK (heading IS NULL OR (heading >= 0 AND heading <= 360)),
  speed_mps numeric CHECK (speed_mps IS NULL OR speed_mps >= 0),
  distance_from_previous_m numeric,
  calculated_speed_mps numeric,
  suspicious boolean NOT NULL DEFAULT false,
  suspicious_reason text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  geo geography(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_driver_location_events_driver_recent
  ON driver_location_events (driver_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_location_events_geo
  ON driver_location_events USING gist (geo);
CREATE INDEX IF NOT EXISTS idx_driver_location_events_suspicious
  ON driver_location_events (suspicious, recorded_at DESC)
  WHERE suspicious = true;

ALTER TABLE driver_location_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS driver_location_events_select ON driver_location_events;
CREATE POLICY driver_location_events_select ON driver_location_events FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_location_events.driver_id
        AND d.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS driver_location_events_insert ON driver_location_events;
CREATE POLICY driver_location_events_insert ON driver_location_events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM drivers d
      WHERE d.id = driver_location_events.driver_id
        AND d.user_id = auth.uid()
    )
    OR public.is_super_admin()
  );

CREATE OR REPLACE FUNCTION public.kiyo_sync_driver_location_event_geo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kiyo_sync_driver_location_event_geo ON driver_location_events;
CREATE TRIGGER trg_kiyo_sync_driver_location_event_geo
BEFORE INSERT OR UPDATE OF latitude, longitude ON driver_location_events
FOR EACH ROW EXECUTE FUNCTION public.kiyo_sync_driver_location_event_geo();

CREATE OR REPLACE FUNCTION public.update_driver_live_location(
  p_driver_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy_m numeric DEFAULT NULL,
  p_heading numeric DEFAULT NULL,
  p_speed_mps numeric DEFAULT NULL,
  p_recorded_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver drivers%ROWTYPE;
  v_previous_geo geography(Point, 4326);
  v_new_geo geography(Point, 4326);
  v_previous_at timestamptz;
  v_distance_m numeric;
  v_seconds numeric;
  v_calculated_speed numeric;
  v_suspicious boolean := false;
  v_reason text := 'normal';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_lat IS NULL OR p_lng IS NULL OR p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_coordinates');
  END IF;

  SELECT * INTO v_driver
  FROM drivers
  WHERE id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'driver_not_found');
  END IF;

  IF v_driver.user_id <> auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden_driver_location_update';
  END IF;

  v_previous_geo := v_driver.geo;
  v_previous_at := COALESCE(v_driver.last_location_at, v_driver.last_location_update);
  v_new_geo := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  IF v_previous_geo IS NOT NULL AND v_previous_at IS NOT NULL THEN
    v_distance_m := ST_Distance(v_previous_geo, v_new_geo);
    v_seconds := GREATEST(EXTRACT(EPOCH FROM (p_recorded_at - v_previous_at)), 1);
    v_calculated_speed := v_distance_m / v_seconds;

    IF v_calculated_speed > 45 THEN
      v_suspicious := true;
      v_reason := 'impossible_speed';
    ELSIF p_accuracy_m IS NOT NULL AND p_accuracy_m > 250 THEN
      v_suspicious := true;
      v_reason := 'low_accuracy';
    END IF;
  ELSIF p_accuracy_m IS NOT NULL AND p_accuracy_m > 250 THEN
    v_suspicious := true;
    v_reason := 'low_accuracy';
  END IF;

  UPDATE drivers
  SET
    current_latitude = p_lat,
    current_longitude = p_lng,
    location_accuracy_m = p_accuracy_m,
    heading = p_heading,
    speed_mps = COALESCE(p_speed_mps, v_calculated_speed),
    last_location_at = p_recorded_at,
    last_location_update = p_recorded_at,
    updated_at = now()
  WHERE id = p_driver_id;

  INSERT INTO driver_location_events (
    driver_id,
    latitude,
    longitude,
    accuracy_m,
    heading,
    speed_mps,
    distance_from_previous_m,
    calculated_speed_mps,
    suspicious,
    suspicious_reason,
    recorded_at
  )
  VALUES (
    p_driver_id,
    p_lat,
    p_lng,
    p_accuracy_m,
    p_heading,
    p_speed_mps,
    v_distance_m,
    v_calculated_speed,
    v_suspicious,
    v_reason,
    p_recorded_at
  );

  RETURN jsonb_build_object(
    'ok', true,
    'suspicious', v_suspicious,
    'reason', v_reason,
    'distance_m', v_distance_m,
    'calculated_speed_mps', v_calculated_speed
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_driver_live_location(uuid, double precision, double precision, numeric, numeric, numeric, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_driver_live_location(uuid, double precision, double precision, numeric, numeric, numeric, timestamptz) TO authenticated;
