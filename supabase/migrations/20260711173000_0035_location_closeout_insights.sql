-- Kiyo Food location close-out: exact serviceability social proof and a
-- cross-device, one-time response for repeated-address save suggestions.

CREATE TABLE IF NOT EXISTS public.location_save_prompt_responses (
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_key text NOT NULL,
  response text NOT NULL CHECK (response IN ('dismissed', 'saved_home', 'saved_work')),
  responded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, location_key)
);

ALTER TABLE public.location_save_prompt_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS location_prompt_select_own ON public.location_save_prompt_responses;
CREATE POLICY location_prompt_select_own ON public.location_save_prompt_responses
  FOR SELECT TO authenticated USING (customer_id = auth.uid());

DROP POLICY IF EXISTS location_prompt_insert_own ON public.location_save_prompt_responses;
CREATE POLICY location_prompt_insert_own ON public.location_save_prompt_responses
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS location_prompt_update_own ON public.location_save_prompt_responses;
CREATE POLICY location_prompt_update_own ON public.location_save_prompt_responses
  FOR UPDATE TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_location_insights(
  p_lat double precision,
  p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_destination geography(Point, 4326);
  v_location_key text;
  v_restaurant_count integer := 0;
  v_repeat_order_count integer := 0;
  v_has_saved_address boolean := false;
  v_prompt_responded boolean := false;
BEGIN
  IF NOT public.kiyo_is_coordinate_in_algeria(p_lat, p_lng) THEN
    RAISE EXCEPTION 'Location coordinates must be inside Algeria.' USING ERRCODE = '22023';
  END IF;

  v_destination := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  v_location_key := round(p_lat::numeric, 4)::text || ':' || round(p_lng::numeric, 4)::text;

  SELECT count(*)::integer INTO v_restaurant_count
  FROM public.restaurants r
  WHERE r.status = 'published'
    AND COALESCE(r.max_delivery_km, 10) > 0
    AND (
      (r.geo IS NOT NULL AND ST_DWithin(r.geo, v_destination, COALESCE(r.max_delivery_km, 10) * 1000))
      OR (
        r.geo IS NULL
        AND public.kiyo_is_coordinate_in_algeria(r.latitude, r.longitude)
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)::geography,
          v_destination,
          COALESCE(r.max_delivery_km, 10) * 1000
        )
      )
    );

  IF auth.uid() IS NOT NULL THEN
    SELECT count(*)::integer INTO v_repeat_order_count
    FROM public.orders o
    WHERE o.customer_id = auth.uid()
      AND o.delivery_geo IS NOT NULL
      AND ST_DWithin(o.delivery_geo, v_destination, 100);

    SELECT EXISTS (
      SELECT 1
      FROM public.saved_addresses a
      WHERE a.customer_id = auth.uid()
        AND (
          (a.geo IS NOT NULL AND ST_DWithin(a.geo, v_destination, 100))
          OR (
            a.geo IS NULL
            AND public.kiyo_is_coordinate_in_algeria(a.latitude, a.longitude)
            AND ST_DWithin(
              ST_SetSRID(ST_MakePoint(a.longitude, a.latitude), 4326)::geography,
              v_destination,
              100
            )
          )
        )
    ) INTO v_has_saved_address;

    SELECT EXISTS (
      SELECT 1 FROM public.location_save_prompt_responses p
      WHERE p.customer_id = auth.uid() AND p.location_key = v_location_key
    ) INTO v_prompt_responded;
  END IF;

  RETURN jsonb_build_object(
    'serviceable_restaurant_count', v_restaurant_count,
    'repeat_order_count', v_repeat_order_count,
    'has_saved_address', v_has_saved_address,
    'prompt_responded', v_prompt_responded,
    'location_key', v_location_key
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_location_insights(double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_location_insights(double precision, double precision) TO anon, authenticated;
