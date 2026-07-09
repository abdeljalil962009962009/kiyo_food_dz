-- KIYO FOOD 0031 - Location accuracy hardening
-- Blocks new incomplete/invalid critical coordinates and stores checkout
-- delivery coordinates atomically during order creation.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE OR REPLACE FUNCTION public.kiyo_is_coordinate_in_algeria(
  p_lat double precision,
  p_lng double precision
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_lat BETWEEN 18.5 AND 37.6
     AND p_lng BETWEEN -9.0 AND 12.2;
$$;

ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS geo geography(Point, 4326);

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS location_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS geo geography(Point, 4326);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS delivery_geo geography(Point, 4326);

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS geo geography(Point, 4326);

ALTER TABLE public.restaurant_applications
  ADD COLUMN IF NOT EXISTS location_accuracy_m numeric,
  ADD COLUMN IF NOT EXISTS location_confirmed boolean NOT NULL DEFAULT false;

UPDATE public.restaurants
SET geo = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND geo IS NULL
  AND public.kiyo_is_coordinate_in_algeria(latitude, longitude);

UPDATE public.saved_addresses
SET geo = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND geo IS NULL
  AND public.kiyo_is_coordinate_in_algeria(latitude, longitude);

UPDATE public.orders
SET delivery_geo = ST_SetSRID(ST_MakePoint(delivery_longitude, delivery_latitude), 4326)::geography
WHERE delivery_latitude IS NOT NULL
  AND delivery_longitude IS NOT NULL
  AND delivery_geo IS NULL
  AND public.kiyo_is_coordinate_in_algeria(delivery_latitude, delivery_longitude);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_addresses_valid_algeria_coordinates') THEN
    ALTER TABLE public.saved_addresses
      ADD CONSTRAINT saved_addresses_valid_algeria_coordinates
      CHECK (public.kiyo_is_coordinate_in_algeria(latitude, longitude)) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saved_addresses_accuracy_non_negative') THEN
    ALTER TABLE public.saved_addresses
      ADD CONSTRAINT saved_addresses_accuracy_non_negative
      CHECK (accuracy_m IS NULL OR accuracy_m >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_coordinates_pair_or_empty') THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_coordinates_pair_or_empty
      CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_valid_algeria_coordinates') THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_valid_algeria_coordinates
      CHECK (latitude IS NULL OR public.kiyo_is_coordinate_in_algeria(latitude, longitude)) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_critical_location_confirmed') THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_critical_location_confirmed
      CHECK (
        status NOT IN ('pending_approval', 'published')
        OR (latitude IS NOT NULL AND longitude IS NOT NULL AND location_verified = true)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_location_accuracy_non_negative') THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_location_accuracy_non_negative
      CHECK (location_accuracy_m IS NULL OR location_accuracy_m >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_applications_coordinates_pair_or_empty') THEN
    ALTER TABLE public.restaurant_applications
      ADD CONSTRAINT restaurant_applications_coordinates_pair_or_empty
      CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_applications_valid_algeria_coordinates') THEN
    ALTER TABLE public.restaurant_applications
      ADD CONSTRAINT restaurant_applications_valid_algeria_coordinates
      CHECK (latitude IS NULL OR public.kiyo_is_coordinate_in_algeria(latitude, longitude)) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_applications_confirmed_location_required') THEN
    ALTER TABLE public.restaurant_applications
      ADD CONSTRAINT restaurant_applications_confirmed_location_required
      CHECK (
        status NOT IN ('pending', 'approved')
        OR (latitude IS NOT NULL AND longitude IS NOT NULL AND location_confirmed = true)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_applications_accuracy_non_negative') THEN
    ALTER TABLE public.restaurant_applications
      ADD CONSTRAINT restaurant_applications_accuracy_non_negative
      CHECK (location_accuracy_m IS NULL OR location_accuracy_m >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_coordinates_pair_or_empty') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_coordinates_pair_or_empty
      CHECK (
        (delivery_latitude IS NULL AND delivery_longitude IS NULL)
        OR (delivery_latitude IS NOT NULL AND delivery_longitude IS NOT NULL)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_valid_algeria_delivery_coordinates') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_valid_algeria_delivery_coordinates
      CHECK (delivery_latitude IS NULL OR public.kiyo_is_coordinate_in_algeria(delivery_latitude, delivery_longitude)) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_accuracy_non_negative') THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_accuracy_non_negative
      CHECK (delivery_accuracy_m IS NULL OR delivery_accuracy_m >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_valid_algeria_current_coordinates') THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_valid_algeria_current_coordinates
      CHECK (current_latitude IS NULL OR public.kiyo_is_coordinate_in_algeria(current_latitude, current_longitude)) NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'driver_events_valid_algeria_coordinates') THEN
    ALTER TABLE public.driver_location_events
      ADD CONSTRAINT driver_events_valid_algeria_coordinates
      CHECK (public.kiyo_is_coordinate_in_algeria(latitude, longitude)) NOT VALID;
  END IF;
END $$;

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
  v_notes text := p_payload->>'notes';
  v_delivery_km numeric := COALESCE((p_payload->>'delivery_km')::numeric, 0);
  v_idempotency_key text := p_payload->>'idempotency_key';
  v_finance jsonb;
  v_order_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_mi public.menu_items%ROWTYPE;
  v_restaurant public.restaurants%ROWTYPE;
  v_destination geography(Point, 4326);
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
  IF length(trim(v_delivery_phone)) < 6 THEN
    RAISE EXCEPTION 'Delivery phone is required.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(v_delivery_address)) < 5 THEN
    RAISE EXCEPTION 'Delivery address is required.' USING ERRCODE = '22023';
  END IF;
  IF v_delivery_lat IS NULL OR v_delivery_lng IS NULL THEN
    RAISE EXCEPTION 'Confirmed delivery coordinates are required.' USING ERRCODE = '22023';
  END IF;
  IF NOT public.kiyo_is_coordinate_in_algeria(v_delivery_lat, v_delivery_lng) THEN
    RAISE EXCEPTION 'Delivery coordinates must be inside Algeria.' USING ERRCODE = '22023';
  END IF;
  IF v_delivery_accuracy_m IS NOT NULL AND v_delivery_accuracy_m > 250 THEN
    RAISE EXCEPTION 'Delivery GPS accuracy is too weak. Confirm the pin manually.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_restaurant
  FROM public.restaurants
  WHERE id = v_restaurant_id
    AND status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting orders.' USING ERRCODE = '55006';
  END IF;

  v_destination := ST_SetSRID(ST_MakePoint(v_delivery_lng, v_delivery_lat), 4326)::geography;
  IF v_restaurant.geo IS NOT NULL THEN
    v_delivery_km := ROUND((ST_Distance(v_restaurant.geo, v_destination) / 1000)::numeric, 2);
    IF v_delivery_km > COALESCE(v_restaurant.max_delivery_km, 10) THEN
      RAISE EXCEPTION 'Delivery address is outside this restaurant delivery zone.' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_finance := public.calculate_order_financials(v_items, v_delivery_km);

  BEGIN
    INSERT INTO public.orders (
      customer_id, restaurant_id, status, idempotency_key,
      subtotal, delivery_fee, service_fee, total,
      delivery_address, delivery_phone, delivery_latitude, delivery_longitude,
      delivery_accuracy_m, notes
    ) VALUES (
      v_customer_id, v_restaurant_id, 'pending', v_idempotency_key,
      (v_finance->>'subtotal')::numeric,
      (v_finance->>'delivery_fee')::numeric,
      (v_finance->>'service_fee')::numeric,
      (v_finance->>'total')::numeric,
      v_delivery_address, v_delivery_phone, v_delivery_lat, v_delivery_lng,
      v_delivery_accuracy_m,
      CASE WHEN v_notes IS NULL OR v_notes = '' THEN NULL ELSE v_notes END
    )
    RETURNING id INTO v_order_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'This order was already submitted.' USING ERRCODE = 'P0001';
  END;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_item_id := COALESCE(v_item->>'menu_item_id', v_item->>'id')::uuid;
    SELECT * INTO v_mi FROM public.menu_items WHERE id = v_item_id;

    INSERT INTO public.order_items (order_id, name, quantity, unit_price, notes)
    VALUES (
      v_order_id,
      v_mi.name,
      (v_item->>'quantity')::int,
      v_mi.price,
      NULLIF(v_item->>'notes', '')
    );
  END LOOP;

  INSERT INTO public.financial_ledger (
    order_id, restaurant_id, customer_id,
    order_total, subtotal, delivery_fee, service_fee,
    platform_commission, platform_fee, restaurant_payout, delivery_fee_allocation,
    settlement_status, metadata
  ) VALUES (
    v_order_id, v_restaurant_id, v_customer_id,
    (v_finance->>'total')::numeric,
    (v_finance->>'subtotal')::numeric,
    (v_finance->>'delivery_fee')::numeric,
    (v_finance->>'service_fee')::numeric,
    (v_finance->>'commission')::numeric,
    COALESCE((v_finance->>'platform_fee')::numeric, 0),
    (v_finance->>'subtotal')::numeric - (v_finance->>'commission')::numeric,
    0,
    'pending',
    jsonb_build_object(
      'idempotency_key', v_idempotency_key,
      'source', 'create_order_with_items',
      'delivery_km', v_delivery_km,
      'delivery_accuracy_m', v_delivery_accuracy_m,
      'transaction_fee', COALESCE((v_finance->>'transaction_fee')::numeric, 0),
      'vat', COALESCE((v_finance->>'vat')::numeric, 0)
    )
  );

  PERFORM public.log_activity(
    'order_created',
    'order',
    v_order_id,
    jsonb_build_object('restaurant_id', v_restaurant_id, 'total', v_finance->>'total', 'delivery_km', v_delivery_km)
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'subtotal', v_finance->>'subtotal',
    'delivery_fee', v_finance->>'delivery_fee',
    'service_fee', v_finance->>'service_fee',
    'total', v_finance->>'total'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_with_items(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb) TO authenticated;
