-- Owner Control Center backend contract hardening.

INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('delivery', '{"price_per_km":63,"min_fee":100,"max_fee":500,"free_delivery_threshold":1500,"default_max_delivery_km":10}'::jsonb, 'Delivery pricing rules used by checkout and order creation'),
  ('commission', '{"default_rate":0.07,"service_fee_rate":0.01,"min_commission":0,"max_commission":0}'::jsonb, 'Restaurant commission and customer platform fee rules'),
  ('settlement', '{"due_day":15,"grace_period_days":7,"auto_reminders":true,"late_fee_percent":0}'::jsonb, 'Restaurant settlement schedule and reminder rules'),
  ('operational', '{"maintenance_mode":false,"order_acceptance_timeout":10,"max_active_orders":25,"support_response_sla_minutes":30}'::jsonb, 'Operational limits and support SLA rules'),
  ('features', '{"reviews":true,"reviews_enabled":true,"coupons":true,"promo_codes_enabled":true,"notifications":true,"promotions":true,"maps":true,"delivery_map_enabled":true,"chat":true,"chat_enabled":true,"loyalty":false,"loyalty_points_enabled":false}'::jsonb, 'Platform feature flags consumed by app settings'),
  ('maintenance', '{"enabled":false,"message":"","allow_admin_access":true}'::jsonb, 'Public maintenance mode controls'),
  ('order_rules', '{"cancellation_window_minutes":5,"acceptance_timeout_minutes":10,"auto_cancel_after_timeout":true,"busy_mode_threshold":15,"auto_busy_mode":true}'::jsonb, 'Order lifecycle rules'),
  ('taxes_fees', '{"transaction_fee_fixed":0,"transaction_fee_percent":0,"vat_rate":0}'::jsonb, 'Additional customer fees used in checkout totals'),
  ('driver_rules', '{"base_earning":120,"per_km_earning":35,"min_earning":150,"max_batch_orders":2}'::jsonb, 'Driver payout and assignment rules'),
  ('loyalty_referral', '{"referral_reward_amount":100,"referred_customer_reward":100,"points_per_dzd":0,"points_redemption_rate":0}'::jsonb, 'Referral and loyalty economics')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value || public.platform_settings.value,
  description = COALESCE(public.platform_settings.description, EXCLUDED.description),
  updated_at = now();

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_insert_admin ON public.platform_settings;
CREATE POLICY settings_insert_admin ON public.platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS settings_update_admin ON public.platform_settings;
CREATE POLICY settings_update_admin ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.validate_platform_setting_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed text[] := ARRAY[
    'delivery','commission','settlement','operational','features','maintenance',
    'order_rules','taxes_fees','driver_rules','loyalty_referral',
    'location_privacy','map_provider'
  ];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can change owner control settings.' USING ERRCODE = '42501';
  END IF;
  IF NEW.key IS NULL OR NOT NEW.key = ANY(v_allowed) THEN
    RAISE EXCEPTION 'Unsupported platform setting key: %', COALESCE(NEW.key, '<null>') USING ERRCODE = '22023';
  END IF;
  IF NEW.value IS NULL OR jsonb_typeof(NEW.value) <> 'object' THEN
    RAISE EXCEPTION 'Platform setting % must be a JSON object.', NEW.key USING ERRCODE = '22023';
  END IF;

  IF NEW.key = 'delivery' THEN
    IF COALESCE((NEW.value->>'price_per_km')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'min_fee')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'max_fee')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'free_delivery_threshold')::numeric, 0) < 0 THEN
      RAISE EXCEPTION 'Delivery fees cannot be negative.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE((NEW.value->>'max_fee')::numeric, 0) > 0
      AND COALESCE((NEW.value->>'min_fee')::numeric, 0) > COALESCE((NEW.value->>'max_fee')::numeric, 0) THEN
      RAISE EXCEPTION 'Minimum delivery fee cannot be greater than maximum delivery fee.' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key = 'commission' THEN
    IF COALESCE((NEW.value->>'default_rate')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'default_rate')::numeric, 0) > 1
      OR COALESCE((NEW.value->>'service_fee_rate')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'service_fee_rate')::numeric, 0) > 1 THEN
      RAISE EXCEPTION 'Commission and service fee rates must be between 0 and 1.' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key = 'settlement' THEN
    IF COALESCE((NEW.value->>'due_day')::int, 15) < 1 OR COALESCE((NEW.value->>'due_day')::int, 15) > 28 THEN
      RAISE EXCEPTION 'Settlement due day must be between 1 and 28.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE((NEW.value->>'grace_period_days')::int, 0) < 0 THEN
      RAISE EXCEPTION 'Settlement grace period cannot be negative.' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key = 'taxes_fees' THEN
    IF COALESCE((NEW.value->>'transaction_fee_fixed')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'transaction_fee_percent')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'transaction_fee_percent')::numeric, 0) > 1
      OR COALESCE((NEW.value->>'vat_rate')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'vat_rate')::numeric, 0) > 1 THEN
      RAISE EXCEPTION 'Taxes and fees must be non-negative; percentage rates must be between 0 and 1.' USING ERRCODE = '22023';
    END IF;
  ELSIF NEW.key = 'driver_rules' THEN
    IF COALESCE((NEW.value->>'base_earning')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'per_km_earning')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'min_earning')::numeric, 0) < 0
      OR COALESCE((NEW.value->>'max_batch_orders')::int, 1) < 1 THEN
      RAISE EXCEPTION 'Driver earning rules must be positive values.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.key = 'features' THEN
    NEW.value := NEW.value || jsonb_build_object(
      'reviews', COALESCE((NEW.value->>'reviews')::boolean, (NEW.value->>'reviews_enabled')::boolean, true),
      'reviews_enabled', COALESCE((NEW.value->>'reviews_enabled')::boolean, (NEW.value->>'reviews')::boolean, true),
      'coupons', COALESCE((NEW.value->>'coupons')::boolean, (NEW.value->>'promo_codes_enabled')::boolean, true),
      'promo_codes_enabled', COALESCE((NEW.value->>'promo_codes_enabled')::boolean, (NEW.value->>'coupons')::boolean, true),
      'maps', COALESCE((NEW.value->>'maps')::boolean, (NEW.value->>'delivery_map_enabled')::boolean, true),
      'delivery_map_enabled', COALESCE((NEW.value->>'delivery_map_enabled')::boolean, (NEW.value->>'maps')::boolean, true),
      'chat', COALESCE((NEW.value->>'chat')::boolean, (NEW.value->>'chat_enabled')::boolean, true),
      'chat_enabled', COALESCE((NEW.value->>'chat_enabled')::boolean, (NEW.value->>'chat')::boolean, true),
      'loyalty', COALESCE((NEW.value->>'loyalty')::boolean, (NEW.value->>'loyalty_points_enabled')::boolean, false),
      'loyalty_points_enabled', COALESCE((NEW.value->>'loyalty_points_enabled')::boolean, (NEW.value->>'loyalty')::boolean, false)
    );
  END IF;

  NEW.updated_by := COALESCE(NEW.updated_by, auth.uid());
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_platform_setting_row ON public.platform_settings;
CREATE TRIGGER trg_validate_platform_setting_row
  BEFORE INSERT OR UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_platform_setting_row();

CREATE OR REPLACE FUNCTION public.update_platform_setting(p_key text, p_value jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can change owner control settings.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.platform_settings (key, value, updated_by, updated_at)
  VALUES (p_key, p_value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

  PERFORM public.log_activity(
    'platform_setting_updated',
    'platform_setting',
    NULL,
    jsonb_build_object('key', p_key)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_platform_setting(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_platform_setting(text, jsonb) TO authenticated;

ALTER TABLE public.delivery_zones ALTER COLUMN wilaya_id DROP NOT NULL;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP POLICY IF EXISTS zones_modify ON public.delivery_zones;
CREATE POLICY zones_modify ON public.delivery_zones FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.calculate_order_financials(p_items jsonb, p_delivery_km numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery jsonb;
  v_commission_settings jsonb;
  v_tax jsonb;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 0;
  v_commission numeric := 0;
  v_platform_fee numeric := 0;
  v_transaction_fee numeric := 0;
  v_vat numeric := 0;
  v_service_fee numeric := 0;
  v_item jsonb;
  v_item_id uuid;
  v_quantity int;
  v_mi record;
  v_price_per_km numeric;
  v_min_fee numeric;
  v_max_fee numeric;
  v_free_threshold numeric;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart must contain at least one menu item.' USING ERRCODE = '22023';
  END IF;

  SELECT value INTO v_delivery FROM public.platform_settings WHERE key = 'delivery';
  SELECT value INTO v_commission_settings FROM public.platform_settings WHERE key = 'commission';
  SELECT value INTO v_tax FROM public.platform_settings WHERE key = 'taxes_fees';

  v_price_per_km := COALESCE((v_delivery->>'price_per_km')::numeric, 63);
  v_min_fee := COALESCE((v_delivery->>'min_fee')::numeric, 100);
  v_max_fee := COALESCE((v_delivery->>'max_fee')::numeric, 500);
  v_free_threshold := COALESCE((v_delivery->>'free_delivery_threshold')::numeric, 1500);
  p_delivery_km := greatest(COALESCE(p_delivery_km, 0), 0);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_id := COALESCE(v_item->>'menu_item_id', v_item->>'id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::int, 0);

    IF v_item_id IS NULL OR v_quantity < 1 OR v_quantity > 99 THEN
      RAISE EXCEPTION 'Invalid cart item or quantity.' USING ERRCODE = '22023';
    END IF;

    SELECT mi.price, mi.is_available INTO v_mi FROM public.menu_items mi WHERE mi.id = v_item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A menu item in the cart no longer exists.' USING ERRCODE = 'P0002';
    END IF;
    IF NOT v_mi.is_available THEN
      RAISE EXCEPTION 'A menu item in the cart is no longer available.' USING ERRCODE = '55006';
    END IF;

    v_subtotal := v_subtotal + (v_mi.price * v_quantity);
  END LOOP;

  IF v_free_threshold > 0 AND v_subtotal >= v_free_threshold THEN
    v_delivery_fee := 0;
  ELSE
    v_delivery_fee := greatest(p_delivery_km * v_price_per_km, v_min_fee);
    IF v_max_fee > 0 THEN
      v_delivery_fee := least(v_delivery_fee, v_max_fee);
    END IF;
  END IF;

  v_commission := round((v_subtotal + v_delivery_fee) * COALESCE((v_commission_settings->>'default_rate')::numeric, 0.07), 2);
  v_platform_fee := round((v_subtotal + v_delivery_fee) * COALESCE((v_commission_settings->>'service_fee_rate')::numeric, 0.01), 2);
  v_transaction_fee := round(COALESCE((v_tax->>'transaction_fee_fixed')::numeric, 0) + ((v_subtotal + v_delivery_fee) * COALESCE((v_tax->>'transaction_fee_percent')::numeric, 0)), 2);
  v_vat := round((v_subtotal + v_delivery_fee + v_platform_fee + v_transaction_fee) * COALESCE((v_tax->>'vat_rate')::numeric, 0), 2);
  v_service_fee := v_commission + v_platform_fee + v_transaction_fee + v_vat;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'service_fee', v_service_fee,
    'commission', v_commission,
    'platform_fee', v_platform_fee,
    'transaction_fee', v_transaction_fee,
    'vat', v_vat,
    'total', v_subtotal + v_delivery_fee + v_service_fee,
    'delivery_km', p_delivery_km,
    'free_delivery', v_subtotal >= v_free_threshold AND v_free_threshold > 0
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_order_financials(jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_order_financials(jsonb, numeric) TO authenticated;

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
  v_notes text := p_payload->>'notes';
  v_delivery_km numeric := COALESCE((p_payload->>'delivery_km')::numeric, 0);
  v_idempotency_key text := p_payload->>'idempotency_key';
  v_finance jsonb;
  v_order_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_mi public.menu_items%ROWTYPE;
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
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = v_restaurant_id AND status = 'published') THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting orders.' USING ERRCODE = '55006';
  END IF;

  v_finance := public.calculate_order_financials(v_items, v_delivery_km);

  BEGIN
    INSERT INTO public.orders (
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
      'transaction_fee', COALESCE((v_finance->>'transaction_fee')::numeric, 0),
      'vat', COALESCE((v_finance->>'vat')::numeric, 0)
    )
  );

  PERFORM public.log_activity('order_created', 'order', v_order_id, jsonb_build_object('restaurant_id', v_restaurant_id, 'total', v_finance->>'total'));

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

CREATE OR REPLACE FUNCTION public.owner_control_center_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_required text[] := ARRAY[
    'delivery','commission','settlement','operational','features','maintenance',
    'order_rules','taxes_fees','driver_rules','loyalty_referral'
  ];
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can inspect owner control health.' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'missing_settings', COALESCE((
      SELECT jsonb_agg(k)
      FROM unnest(v_required) AS k
      WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings ps WHERE ps.key = k)
    ), '[]'::jsonb),
    'platform_settings_count', (SELECT count(*) FROM public.platform_settings),
    'delivery_zones_count', (SELECT count(*) FROM public.delivery_zones),
    'restaurants_count', (SELECT count(*) FROM public.restaurants),
    'drivers_count', (SELECT count(*) FROM public.drivers),
    'open_orders_count', (SELECT count(*) FROM public.orders WHERE status NOT IN ('delivered','cancelled','failed_delivery','refunded')),
    'generated_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.owner_control_center_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_control_center_health() TO authenticated;
