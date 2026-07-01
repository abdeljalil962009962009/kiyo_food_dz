-- ============================================================================
-- KIYO FOOD Phase 6.5 — Fix: calculate_order_financials now reads delivery
-- pricing from platform_settings instead of hardcoded values.
-- Also reads commission + service fee rates from platform_settings.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_order_financials(
  p_items jsonb,
  p_delivery_km numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2);
  v_commission numeric(12,2);
  v_platform_fee numeric(12,2);
  v_service_fee numeric(12,2);
  v_total numeric(12,2);
  v_item record;
  v_mi menu_items%ROWTYPE;
  v_validated_items jsonb := '[]'::jsonb;
  v_settings jsonb;
  v_price_per_km numeric := 63;
  v_min_fee numeric := 100;
  v_max_fee numeric := 2000;
  v_free_threshold numeric := 0;
  v_commission_rate numeric := 0.07;
  v_service_rate numeric := 0.01;
BEGIN
  IF NOT jsonb_typeof(p_items) = 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array' USING ERRCODE = '22023';
  END IF;
  IF p_delivery_km IS NULL OR p_delivery_km < 0 THEN
    RAISE EXCEPTION 'delivery_km must be >= 0' USING ERRCODE = '22023';
  END IF;

  -- Read delivery + commission settings from platform_settings
  SELECT value INTO v_settings FROM platform_settings WHERE key = 'delivery';
  IF v_settings IS NOT NULL THEN
    v_price_per_km := COALESCE((v_settings->>'price_per_km')::numeric, 63);
    v_min_fee := COALESCE((v_settings->>'min_fee')::numeric, 100);
    v_max_fee := COALESCE((v_settings->>'max_fee')::numeric, 2000);
    v_free_threshold := COALESCE((v_settings->>'free_delivery_threshold')::numeric, 0);
  END IF;

  SELECT value INTO v_settings FROM platform_settings WHERE key = 'commission';
  IF v_settings IS NOT NULL THEN
    v_commission_rate := COALESCE((v_settings->>'default_rate')::numeric, 0.07);
    v_service_rate := COALESCE((v_settings->>'service_fee_rate')::numeric, 0.01);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF (v_item.value->>'quantity')::int IS NULL OR (v_item.value->>'quantity')::int <= 0 THEN
      RAISE EXCEPTION 'invalid quantity for item %', v_item.value->>'menu_item_id'
      USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_mi FROM menu_items WHERE id = (v_item.value->>'menu_item_id')::uuid;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'menu item not found: %', v_item.value->>'menu_item_id'
      USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_mi.is_available THEN
      RAISE EXCEPTION 'menu item out of stock: %', v_mi.name
      USING ERRCODE = 'P0003';
    END IF;

    v_subtotal := v_subtotal + (v_mi.price * (v_item.value->>'quantity')::int);

    v_validated_items := v_validated_items || jsonb_build_object(
      'name', v_mi.name,
      'quantity', (v_item.value->>'quantity')::int,
      'unit_price', v_mi.price
    );
  END LOOP;

  -- Delivery fee: price_per_km * km, clamped to [min_fee, max_fee]
  -- Free delivery if subtotal >= free_delivery_threshold (and threshold > 0)
  IF v_free_threshold > 0 AND v_subtotal >= v_free_threshold THEN
    v_delivery_fee := 0;
  ELSE
    v_delivery_fee := LEAST(GREATEST(p_delivery_km * v_price_per_km, v_min_fee), v_max_fee);
  END IF;

  -- Platform commission + service fee on (subtotal + delivery)
  v_commission := ROUND((v_subtotal + v_delivery_fee) * v_commission_rate, 2);
  v_platform_fee := ROUND((v_subtotal + v_delivery_fee) * v_service_rate, 2);

  -- Customer-facing service fee = commission + platform_fee
  v_service_fee := v_commission + v_platform_fee;

  -- Total = subtotal + delivery + service_fee
  v_total := v_subtotal + v_delivery_fee + v_service_fee;

  RETURN jsonb_build_object(
    'items', v_validated_items,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'service_fee', v_service_fee,
    'commission', v_commission,
    'platform_fee', v_platform_fee,
    'total', v_total
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.calculate_order_financials(jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_order_financials(jsonb, numeric) TO authenticated;

-- Also update create_order_with_items to read rates from settings (not hardcoded 0.07/0.01)
CREATE OR REPLACE FUNCTION public.create_order_with_items(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id uuid := auth.uid();
  v_restaurant_id uuid;
  v_items jsonb;
  v_delivery_address text;
  v_delivery_phone text;
  v_notes text;
  v_delivery_km numeric := 0;
  v_idempotency_key text;
  v_finance jsonb;
  v_order_id uuid;
  v_items_to_insert jsonb;
  v_item jsonb;
  v_mi menu_items%ROWTYPE;
  v_commission numeric;
  v_service numeric;
  v_payout numeric;
  v_settings jsonb;
  v_commission_rate numeric := 0.07;
  v_service_rate numeric := 0.01;
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  v_restaurant_id := (p_payload->>'restaurant_id')::uuid;
  v_items := p_payload->'items';
  v_delivery_address := COALESCE(p_payload->>'delivery_address', '');
  v_delivery_phone := COALESCE(p_payload->>'delivery_phone', '');
  v_notes := p_payload->>'notes';
  v_idempotency_key := p_payload->>'idempotency_key';
  IF (p_payload->>'delivery_km') IS NOT NULL THEN
    v_delivery_km := (p_payload->>'delivery_km')::numeric;
  END IF;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id required' USING ERRCODE = '22023';
  END IF;
  IF v_idempotency_key IS NULL OR length(v_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'idempotency_key required (>= 8 chars)' USING ERRCODE = '22023';
  END IF;
  IF NOT jsonb_typeof(v_items) = 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'items must be a non-empty array' USING ERRCODE = '22023';
  END IF;
  IF length(trim(v_delivery_phone)) < 6 THEN
    RAISE EXCEPTION 'delivery_phone required' USING ERRCODE = '22023';
  END IF;
  IF length(trim(v_delivery_address)) < 5 THEN
    RAISE EXCEPTION 'delivery_address required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.id = v_restaurant_id AND r.status = 'published'
  ) THEN
    RAISE EXCEPTION 'restaurant is not currently accepting orders' USING ERRCODE = '55006';
  END IF;

  v_finance := public.calculate_order_financials(v_items, v_delivery_km);

  BEGIN
    INSERT INTO orders (
      customer_id, restaurant_id, status, idempotency_key,
      subtotal, delivery_fee, service_fee, total,
      delivery_address, delivery_phone, notes
    ) VALUES (
      v_customer_id, v_restaurant_id, 'pending', v_idempotency_key,
      (v_finance->>'subtotal')::numeric,
      (v_finance->>'delivery_fee')::numeric,
      (v_finance->>'service_fee')::numeric,
      (v_finance->>'total')::numeric,
      v_delivery_address, v_delivery_phone,
      CASE WHEN v_notes IS NULL OR v_notes = '' THEN NULL ELSE v_notes END
    )
    RETURNING id INTO v_order_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'duplicate_order' USING ERRCODE = 'P0001';
  END;

  v_items_to_insert := '[]'::jsonb;
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    SELECT * INTO v_mi FROM menu_items
      WHERE id = (v_item->>'menu_item_id')::uuid;
    v_items_to_insert := v_items_to_insert || jsonb_build_array(jsonb_build_object(
      'order_id', v_order_id,
      'name', v_mi.name,
      'quantity', (v_item->>'quantity')::int,
      'unit_price', v_mi.price,
      'notes', COALESCE(v_item->>'notes', NULL)
    ));
  END LOOP;

  INSERT INTO order_items (order_id, name, quantity, unit_price, notes)
  SELECT
    (j->>'order_id')::uuid,
    j->>'name',
    (j->>'quantity')::int,
    (j->>'unit_price')::numeric,
    j->>'notes'
  FROM jsonb_array_elements(v_items_to_insert) AS t(j);

  -- ---------- IMMUTABLE LEDGER ENTRY ----------
  -- Read commission + service rates from platform_settings (same source as calculate_order_financials)
  SELECT value INTO v_settings FROM platform_settings WHERE key = 'commission';
  IF v_settings IS NOT NULL THEN
    v_commission_rate := COALESCE((v_settings->>'default_rate')::numeric, 0.07);
    v_service_rate := COALESCE((v_settings->>'service_fee_rate')::numeric, 0.01);
  END IF;

  v_commission := round(
    ((v_finance->>'subtotal')::numeric + (v_finance->>'delivery_fee')::numeric) * v_commission_rate,
    2
  );
  v_service := round(
    ((v_finance->>'subtotal')::numeric + (v_finance->>'delivery_fee')::numeric) * v_service_rate,
    2
  );
  v_payout := (v_finance->>'subtotal')::numeric - v_commission;

  INSERT INTO financial_ledger (
    order_id, restaurant_id, customer_id,
    order_total, subtotal, delivery_fee, service_fee,
    platform_commission, restaurant_payout,
    settlement_status, metadata
  ) VALUES (
    v_order_id, v_restaurant_id, v_customer_id,
    (v_finance->>'total')::numeric,
    (v_finance->>'subtotal')::numeric,
    (v_finance->>'delivery_fee')::numeric,
    v_service,
    v_commission,
    v_payout,
    'pending',
    jsonb_build_object('idempotency_key', v_idempotency_key, 'source', 'create_order_with_items')
  );

  PERFORM public.log_activity(
    'order_created',
    'order',
    v_order_id,
    jsonb_build_object('restaurant_id', v_restaurant_id, 'total', v_finance->>'total')
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
