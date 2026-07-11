-- Kiyo Food Phase 34: precise delivery contract
-- Adds structured address details and makes distance, serviceability, fees,
-- and order destination snapshots authoritative on the database server.

BEGIN;

ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS apartment text,
  ADD COLUMN IF NOT EXISTS entrance text,
  ADD COLUMN IF NOT EXISTS landmark text,
  ADD COLUMN IF NOT EXISTS driver_instructions text;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS commune text,
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.restaurant_applications
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS commune text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Algeria';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_place_id text,
  ADD COLUMN IF NOT EXISTS delivery_location_source text,
  ADD COLUMN IF NOT EXISTS delivery_commune text,
  ADD COLUMN IF NOT EXISTS delivery_wilaya text,
  ADD COLUMN IF NOT EXISTS delivery_postal_code text,
  ADD COLUMN IF NOT EXISTS delivery_building text,
  ADD COLUMN IF NOT EXISTS delivery_floor text,
  ADD COLUMN IF NOT EXISTS delivery_apartment text,
  ADD COLUMN IF NOT EXISTS delivery_entrance text,
  ADD COLUMN IF NOT EXISTS delivery_landmark text,
  ADD COLUMN IF NOT EXISTS delivery_instructions text,
  ADD COLUMN IF NOT EXISTS delivery_distance_km numeric(10,2),
  ADD COLUMN IF NOT EXISTS delivery_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS delivery_quoted_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_location_source_valid') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_location_source_valid
      CHECK (delivery_location_source IS NULL OR delivery_location_source IN ('gps', 'network', 'manual', 'search')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_distance_non_negative') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_distance_non_negative
      CHECK (delivery_distance_km IS NULL OR delivery_distance_km >= 0) NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_quote
  ON public.orders(restaurant_id, delivery_quoted_at DESC)
  WHERE delivery_distance_km IS NOT NULL;

CREATE OR REPLACE FUNCTION public.quote_delivery_order(
  p_restaurant_id uuid,
  p_items jsonb,
  p_delivery_lat double precision,
  p_delivery_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_restaurant_geo geography(Point, 4326);
  v_destination geography(Point, 4326);
  v_distance_km numeric(10,2);
  v_duration_minutes integer;
  v_finance jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to request a delivery quote.' USING ERRCODE = '42501';
  END IF;
  IF p_restaurant_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Restaurant and cart items are required.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.kiyo_is_coordinate_in_algeria(p_delivery_lat, p_delivery_lng) THEN
    RAISE EXCEPTION 'Delivery coordinates must be inside Algeria.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = p_restaurant_id AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting orders.' USING ERRCODE = '55006';
  END IF;

  v_restaurant_geo := v_restaurant.geo;
  IF v_restaurant_geo IS NULL
     AND public.kiyo_is_coordinate_in_algeria(v_restaurant.latitude, v_restaurant.longitude) THEN
    v_restaurant_geo := ST_SetSRID(ST_MakePoint(v_restaurant.longitude, v_restaurant.latitude), 4326)::geography;
  END IF;
  IF v_restaurant_geo IS NULL THEN
    RAISE EXCEPTION 'Restaurant location has not been verified.' USING ERRCODE = '22023';
  END IF;

  v_destination := ST_SetSRID(ST_MakePoint(p_delivery_lng, p_delivery_lat), 4326)::geography;
  v_distance_km := ROUND((ST_Distance(v_restaurant_geo, v_destination) / 1000)::numeric, 2);
  IF v_distance_km > COALESCE(v_restaurant.max_delivery_km, 10) THEN
    RAISE EXCEPTION 'Delivery address is outside this restaurant delivery zone.' USING ERRCODE = '22023';
  END IF;

  v_finance := public.calculate_order_financials(p_items, v_distance_km);
  v_duration_minutes := GREATEST(8, CEIL((v_distance_km / 22 * 60) + 23)::integer);

  RETURN v_finance || jsonb_build_object(
    'distance_km', v_distance_km,
    'duration_minutes', v_duration_minutes,
    'max_delivery_km', COALESCE(v_restaurant.max_delivery_km, 10),
    'distance_method', 'postgis_geodesic',
    'quoted_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.quote_delivery_order(uuid, jsonb, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_delivery_order(uuid, jsonb, double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_order_with_items(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id uuid := auth.uid();
  v_restaurant_id uuid := (p_payload->>'restaurant_id')::uuid;
  v_items jsonb := p_payload->'items';
  v_delivery_address text := COALESCE(p_payload->>'delivery_address', '');
  v_delivery_phone text := COALESCE(p_payload->>'delivery_phone', '');
  v_delivery_lat double precision := (p_payload->>'delivery_latitude')::double precision;
  v_delivery_lng double precision := (p_payload->>'delivery_longitude')::double precision;
  v_delivery_accuracy_m numeric := NULLIF(p_payload->>'delivery_accuracy_m', '')::numeric;
  v_delivery_confirmed boolean := COALESCE((p_payload->>'delivery_confirmed')::boolean, false);
  v_location_source text := COALESCE(p_payload->>'delivery_location_source', '');
  v_notes text := p_payload->>'notes';
  v_idempotency_key text := p_payload->>'idempotency_key';
  v_finance jsonb;
  v_order_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_mi public.menu_items%ROWTYPE;
  v_restaurant public.restaurants%ROWTYPE;
  v_restaurant_geo geography(Point, 4326);
  v_destination geography(Point, 4326);
  v_delivery_km numeric(10,2);
  v_duration_minutes integer;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order.' USING ERRCODE = '42501';
  END IF;
  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant is required.' USING ERRCODE = '22023';
  END IF;
  IF v_idempotency_key IS NULL OR length(v_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'A valid idempotency key is required.' USING ERRCODE = '22023';
  END IF;
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Cart must contain at least one menu item.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(v_delivery_phone)) < 6 OR length(trim(v_delivery_address)) < 5 THEN
    RAISE EXCEPTION 'A valid delivery phone and address are required.' USING ERRCODE = '22023';
  END IF;
  IF NOT v_delivery_confirmed OR v_delivery_lat IS NULL OR v_delivery_lng IS NULL THEN
    RAISE EXCEPTION 'A confirmed precise delivery location is required.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.kiyo_is_coordinate_in_algeria(v_delivery_lat, v_delivery_lng) THEN
    RAISE EXCEPTION 'Delivery coordinates must be inside Algeria.' USING ERRCODE = '22023';
  END IF;
  IF v_location_source NOT IN ('gps', 'network', 'manual', 'search') THEN
    RAISE EXCEPTION 'Delivery location source is invalid.' USING ERRCODE = '22023';
  END IF;
  IF v_location_source IN ('gps', 'network')
     AND (v_delivery_accuracy_m IS NULL OR v_delivery_accuracy_m > 50) THEN
    RAISE EXCEPTION 'GPS accuracy is too weak. Move and confirm the pin manually.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = v_restaurant_id AND status = 'published';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting orders.' USING ERRCODE = '55006';
  END IF;

  v_restaurant_geo := v_restaurant.geo;
  IF v_restaurant_geo IS NULL
     AND public.kiyo_is_coordinate_in_algeria(v_restaurant.latitude, v_restaurant.longitude) THEN
    v_restaurant_geo := ST_SetSRID(ST_MakePoint(v_restaurant.longitude, v_restaurant.latitude), 4326)::geography;
  END IF;
  IF v_restaurant_geo IS NULL THEN
    RAISE EXCEPTION 'Restaurant location has not been verified.' USING ERRCODE = '22023';
  END IF;

  v_destination := ST_SetSRID(ST_MakePoint(v_delivery_lng, v_delivery_lat), 4326)::geography;
  v_delivery_km := ROUND((ST_Distance(v_restaurant_geo, v_destination) / 1000)::numeric, 2);
  IF v_delivery_km > COALESCE(v_restaurant.max_delivery_km, 10) THEN
    RAISE EXCEPTION 'Delivery address is outside this restaurant delivery zone.' USING ERRCODE = '22023';
  END IF;
  v_duration_minutes := GREATEST(8, CEIL((v_delivery_km / 22 * 60) + 23)::integer);
  v_finance := public.calculate_order_financials(v_items, v_delivery_km);

  BEGIN
    INSERT INTO public.orders (
      customer_id, restaurant_id, status, idempotency_key,
      subtotal, delivery_fee, service_fee, total,
      delivery_address, delivery_phone, delivery_latitude, delivery_longitude,
      delivery_accuracy_m, delivery_place_id, delivery_location_source,
      delivery_commune, delivery_wilaya, delivery_postal_code,
      delivery_building, delivery_floor, delivery_apartment, delivery_entrance,
      delivery_landmark, delivery_instructions, delivery_distance_km,
      delivery_duration_minutes, delivery_quoted_at, notes
    ) VALUES (
      v_customer_id, v_restaurant_id, 'pending', v_idempotency_key,
      (v_finance->>'subtotal')::numeric,
      (v_finance->>'delivery_fee')::numeric,
      (v_finance->>'service_fee')::numeric,
      (v_finance->>'total')::numeric,
      v_delivery_address, v_delivery_phone, v_delivery_lat, v_delivery_lng,
      v_delivery_accuracy_m, NULLIF(p_payload->>'delivery_place_id', ''), v_location_source,
      NULLIF(p_payload->>'delivery_commune', ''), NULLIF(p_payload->>'delivery_wilaya', ''), NULLIF(p_payload->>'delivery_postal_code', ''),
      NULLIF(p_payload->>'delivery_building', ''), NULLIF(p_payload->>'delivery_floor', ''), NULLIF(p_payload->>'delivery_apartment', ''), NULLIF(p_payload->>'delivery_entrance', ''),
      NULLIF(p_payload->>'delivery_landmark', ''), NULLIF(p_payload->>'delivery_instructions', ''), v_delivery_km,
      v_duration_minutes, now(), NULLIF(v_notes, '')
    )
    RETURNING id INTO v_order_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This order was already submitted.' USING ERRCODE = 'P0001';
  END;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_item_id := COALESCE(v_item->>'menu_item_id', v_item->>'id')::uuid;
    SELECT * INTO v_mi
    FROM public.menu_items
    WHERE id = v_item_id AND restaurant_id = v_restaurant_id AND is_available = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A cart item is unavailable or belongs to another restaurant.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.order_items (order_id, name, quantity, unit_price, notes)
    VALUES (v_order_id, v_mi.name, (v_item->>'quantity')::int, v_mi.price, NULLIF(v_item->>'notes', ''));
  END LOOP;

  INSERT INTO public.financial_ledger (
    order_id, restaurant_id, customer_id, order_total, subtotal, delivery_fee,
    service_fee, platform_commission, platform_fee, restaurant_payout,
    delivery_fee_allocation, settlement_status, metadata
  ) VALUES (
    v_order_id, v_restaurant_id, v_customer_id,
    (v_finance->>'total')::numeric, (v_finance->>'subtotal')::numeric,
    (v_finance->>'delivery_fee')::numeric, (v_finance->>'service_fee')::numeric,
    (v_finance->>'commission')::numeric, COALESCE((v_finance->>'platform_fee')::numeric, 0),
    (v_finance->>'subtotal')::numeric - (v_finance->>'commission')::numeric,
    0, 'pending',
    jsonb_build_object(
      'idempotency_key', v_idempotency_key,
      'source', 'create_order_with_items',
      'delivery_km', v_delivery_km,
      'delivery_duration_minutes', v_duration_minutes,
      'delivery_accuracy_m', v_delivery_accuracy_m,
      'transaction_fee', COALESCE((v_finance->>'transaction_fee')::numeric, 0),
      'vat', COALESCE((v_finance->>'vat')::numeric, 0)
    )
  );

  PERFORM public.log_activity(
    'order_created', 'order', v_order_id,
    jsonb_build_object('restaurant_id', v_restaurant_id, 'total', v_finance->>'total', 'delivery_km', v_delivery_km)
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'subtotal', v_finance->>'subtotal',
    'delivery_fee', v_finance->>'delivery_fee',
    'service_fee', v_finance->>'service_fee',
    'total', v_finance->>'total',
    'distance_km', v_delivery_km,
    'duration_minutes', v_duration_minutes
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_with_items(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb) TO authenticated;

COMMIT;
