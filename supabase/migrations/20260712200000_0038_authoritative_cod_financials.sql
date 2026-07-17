-- Kiyo Food 0038: authoritative COD routing, rule resolution and snapshots.
-- Depends on 0037. This migration intentionally fails final order creation
-- without a fresh server-recorded Google Routes quote.

BEGIN;

CREATE TABLE IF NOT EXISTS public.marketplace_rule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL CHECK (scope_type IN ('wilaya','restaurant')),
  scope_id text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled','active','replaced','cancelled')),
  values jsonb NOT NULL CHECK (jsonb_typeof(values) = 'object'),
  effective_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scope_type, scope_id, version),
  CHECK (expires_at IS NULL OR expires_at > effective_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_rule_override_current
  ON public.marketplace_rule_overrides(scope_type, scope_id)
  WHERE status IN ('scheduled','active');
CREATE INDEX IF NOT EXISTS idx_marketplace_rule_override_effective
  ON public.marketplace_rule_overrides(scope_type, scope_id, effective_at DESC);

ALTER TABLE public.marketplace_rule_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketplace_rule_overrides_admin_select ON public.marketplace_rule_overrides;
CREATE POLICY marketplace_rule_overrides_admin_select
  ON public.marketplace_rule_overrides FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.set_marketplace_rule_override(
  p_scope_type text,
  p_scope_id text,
  p_values jsonb,
  p_effective_at timestamptz DEFAULT now(),
  p_reason text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
)
RETURNS public.marketplace_rule_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.marketplace_rule_overrides%ROWTYPE;
  v_result public.marketplace_rule_overrides%ROWTYPE;
  v_next_version integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can change marketplace rules.' USING ERRCODE = '42501';
  END IF;
  IF p_scope_type NOT IN ('wilaya','restaurant') OR length(trim(COALESCE(p_scope_id,''))) = 0
     OR p_values IS NULL OR jsonb_typeof(p_values) <> 'object' THEN
    RAISE EXCEPTION 'A valid rule scope and object value are required.' USING ERRCODE = '22023';
  END IF;
  IF p_scope_type = 'restaurant'
     AND NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_scope_id::uuid) THEN
    RAISE EXCEPTION 'Restaurant rule scope does not exist.' USING ERRCODE = 'P0002';
  END IF;
  IF p_scope_type = 'wilaya'
     AND NOT EXISTS (SELECT 1 FROM public.wilayas WHERE id = p_scope_id::smallint) THEN
    RAISE EXCEPTION 'Wilaya rule scope does not exist.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_current
  FROM public.marketplace_rule_overrides
  WHERE scope_type = p_scope_type AND scope_id = p_scope_id
    AND status IN ('scheduled','active')
  FOR UPDATE;
  IF p_expected_version IS NOT NULL
     AND (v_current.id IS NULL OR v_current.version <> p_expected_version) THEN
    RAISE EXCEPTION 'Rules changed in another session. Reload before saving.' USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(max(version), 0) + 1 INTO v_next_version
  FROM public.marketplace_rule_overrides
  WHERE scope_type = p_scope_type AND scope_id = p_scope_id;
  UPDATE public.marketplace_rule_overrides
  SET status = 'replaced',
      expires_at = CASE WHEN effective_at < now() THEN LEAST(COALESCE(expires_at, now()), now()) ELSE NULL END,
      updated_at = now()
  WHERE id = v_current.id;

  INSERT INTO public.marketplace_rule_overrides (
    scope_type, scope_id, version, status, values, effective_at, created_by, reason
  ) VALUES (
    p_scope_type, p_scope_id, v_next_version,
    CASE WHEN COALESCE(p_effective_at, now()) > now() THEN 'scheduled' ELSE 'active' END,
    p_values, COALESCE(p_effective_at, now()), auth.uid(), NULLIF(trim(p_reason), '')
  ) RETURNING * INTO v_result;

  PERFORM public.log_activity(
    'admin_action', 'marketplace_rule_override', v_result.id,
    jsonb_build_object(
      'action', 'rule_override_set', 'scope_type', p_scope_type, 'scope_id', p_scope_id,
      'previous_version', v_current.version, 'new_version', v_result.version,
      'previous_values', v_current.values, 'new_values', v_result.values,
      'effective_at', v_result.effective_at, 'reason', p_reason
    )
  );
  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_marketplace_rule_override(text, text, jsonb, timestamptz, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_marketplace_rule_override(text, text, jsonb, timestamptz, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_marketplace_rule_override(
  p_scope_type text,
  p_scope_id text,
  p_expected_version integer,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.marketplace_rule_overrides%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can remove marketplace rules.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_current FROM public.marketplace_rule_overrides
  WHERE scope_type = p_scope_type AND scope_id = p_scope_id
    AND status IN ('scheduled','active') FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_current.version <> p_expected_version THEN
    RAISE EXCEPTION 'Rules changed in another session. Reload before removing the override.' USING ERRCODE = '40001';
  END IF;
  UPDATE public.marketplace_rule_overrides
  SET status = 'cancelled',
      expires_at = CASE WHEN effective_at < now() THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = v_current.id;
  PERFORM public.log_activity(
    'admin_action', 'marketplace_rule_override', v_current.id,
    jsonb_build_object(
      'action', 'rule_override_removed', 'scope_type', p_scope_type,
      'scope_id', p_scope_id, 'version', v_current.version,
      'previous_values', v_current.values, 'reason', p_reason
    )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_marketplace_rule_override(text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_marketplace_rule_override(text, text, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_marketplace_rules(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_delivery jsonb := '{}'::jsonb;
  v_commission jsonb := '{}'::jsonb;
  v_taxes jsonb := '{}'::jsonb;
  v_wilaya public.marketplace_rule_overrides%ROWTYPE;
  v_restaurant_override public.marketplace_rule_overrides%ROWTYPE;
  v_term public.restaurant_commercial_terms%ROWTYPE;
  v_global_updated timestamptz;
BEGIN
  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002'; END IF;

  SELECT value, updated_at INTO v_delivery, v_global_updated
  FROM public.platform_settings WHERE key = 'delivery';
  SELECT value INTO v_commission FROM public.platform_settings WHERE key = 'commission';
  SELECT value INTO v_taxes FROM public.platform_settings WHERE key = 'taxes_fees';

  IF v_restaurant.wilaya_id IS NOT NULL THEN
    SELECT * INTO v_wilaya FROM public.marketplace_rule_overrides
    WHERE scope_type = 'wilaya' AND scope_id = v_restaurant.wilaya_id::text
      AND status IN ('active','scheduled') AND effective_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY version DESC LIMIT 1;
  END IF;
  SELECT * INTO v_restaurant_override FROM public.marketplace_rule_overrides
  WHERE scope_type = 'restaurant' AND scope_id = p_restaurant_id::text
    AND status IN ('active','scheduled') AND effective_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY version DESC LIMIT 1;

  v_delivery := COALESCE(v_delivery, '{}'::jsonb)
    || COALESCE(v_wilaya.values->'delivery', '{}'::jsonb)
    || COALESCE(v_restaurant_override.values->'delivery', '{}'::jsonb);
  v_commission := COALESCE(v_commission, '{}'::jsonb)
    || COALESCE(v_wilaya.values->'commission', '{}'::jsonb)
    || COALESCE(v_restaurant_override.values->'commission', '{}'::jsonb);
  v_taxes := COALESCE(v_taxes, '{}'::jsonb)
    || COALESCE(v_wilaya.values->'taxes_fees', '{}'::jsonb)
    || COALESCE(v_restaurant_override.values->'taxes_fees', '{}'::jsonb);

  SELECT * INTO v_term FROM public.restaurant_commercial_terms
  WHERE restaurant_id = p_restaurant_id AND status IN ('active','scheduled')
    AND effective_at <= now() AND (expires_at IS NULL OR expires_at > now())
  ORDER BY version DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active approved commercial agreement exists for this restaurant.' USING ERRCODE = '55006';
  END IF;

  v_delivery := v_delivery || jsonb_build_object(
    'max_delivery_km', COALESCE(
      (v_restaurant_override.values->'delivery'->>'max_delivery_km')::numeric,
      v_restaurant.max_delivery_km,
      (v_wilaya.values->'delivery'->>'max_delivery_km')::numeric,
      (v_delivery->>'default_max_delivery_km')::numeric,
      10
    ),
    'minimum_order', COALESCE(
      (v_restaurant_override.values->'delivery'->>'minimum_order')::numeric,
      v_restaurant.min_order_amount,
      (v_wilaya.values->'delivery'->>'minimum_order')::numeric,
      0
    )
  );

  RETURN jsonb_build_object(
    'delivery', v_delivery,
    'commission', v_commission || jsonb_build_object(
      'commercial_term_id', v_term.id,
      'commercial_term_version', v_term.version,
      'commission_base', v_term.commission_base,
      'food_commission_rate', v_term.food_commission_rate,
      'delivery_share_rate', v_term.delivery_share_rate
    ),
    'taxes_fees', v_taxes,
    'sources', jsonb_build_object(
      'global_updated_at', v_global_updated,
      'wilaya_override_id', v_wilaya.id,
      'wilaya_override_version', v_wilaya.version,
      'restaurant_override_id', v_restaurant_override.id,
      'restaurant_override_version', v_restaurant_override.version,
      'commercial_term_id', v_term.id,
      'commercial_term_version', v_term.version
    )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.resolve_marketplace_rules(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_marketplace_rules(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.delivery_route_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  origin_latitude double precision NOT NULL,
  origin_longitude double precision NOT NULL,
  destination_latitude double precision NOT NULL,
  destination_longitude double precision NOT NULL,
  distance_meters integer NOT NULL CHECK (distance_meters > 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0),
  provider text NOT NULL CHECK (provider = 'google_routes'),
  provider_request_id text,
  rule_snapshot jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_route_quotes_customer
  ON public.delivery_route_quotes(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_route_quotes_expiry
  ON public.delivery_route_quotes(expires_at) WHERE consumed_at IS NULL;
ALTER TABLE public.delivery_route_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS delivery_route_quotes_select_own ON public.delivery_route_quotes;
CREATE POLICY delivery_route_quotes_select_own ON public.delivery_route_quotes
  FOR SELECT TO authenticated USING (customer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_trusted_delivery_route(
  p_customer_id uuid,
  p_restaurant_id uuid,
  p_destination_latitude double precision,
  p_destination_longitude double precision,
  p_distance_meters integer,
  p_duration_seconds integer,
  p_provider_request_id text DEFAULT NULL
)
RETURNS public.delivery_route_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_quote public.delivery_route_quotes%ROWTYPE;
  v_rules jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only the trusted routing service can record route quotes.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_restaurant FROM public.restaurants
  WHERE id = p_restaurant_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant is not currently available.' USING ERRCODE = '55006'; END IF;
  IF NOT public.kiyo_is_coordinate_in_algeria(v_restaurant.latitude, v_restaurant.longitude)
     OR NOT public.kiyo_is_coordinate_in_algeria(p_destination_latitude, p_destination_longitude)
     OR p_distance_meters <= 0 OR p_duration_seconds <= 0 THEN
    RAISE EXCEPTION 'Trusted route data is invalid.' USING ERRCODE = '22023';
  END IF;
  v_rules := public.resolve_marketplace_rules(p_restaurant_id);
  INSERT INTO public.delivery_route_quotes (
    customer_id, restaurant_id, origin_latitude, origin_longitude,
    destination_latitude, destination_longitude, distance_meters,
    duration_seconds, provider, provider_request_id, rule_snapshot, expires_at
  ) VALUES (
    p_customer_id, p_restaurant_id, v_restaurant.latitude, v_restaurant.longitude,
    p_destination_latitude, p_destination_longitude, p_distance_meters,
    p_duration_seconds, 'google_routes', NULLIF(p_provider_request_id, ''),
    v_rules, now() + interval '10 minutes'
  ) RETURNING * INTO v_quote;
  RETURN v_quote;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_trusted_delivery_route(uuid, uuid, double precision, double precision, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_trusted_delivery_route(uuid, uuid, double precision, double precision, integer, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_marketplace_order_financials(
  p_restaurant_id uuid,
  p_items jsonb,
  p_distance_meters integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rules jsonb := public.resolve_marketplace_rules(p_restaurant_id);
  v_delivery jsonb;
  v_commission jsonb;
  v_taxes jsonb;
  v_item jsonb;
  v_menu_item public.menu_items%ROWTYPE;
  v_item_id uuid;
  v_quantity integer;
  v_items_snapshot jsonb := '[]'::jsonb;
  v_subtotal numeric(12,2) := 0;
  v_distance_km numeric(10,3) := round((p_distance_meters::numeric / 1000), 3);
  v_delivery_fee numeric(12,2);
  v_food_commission numeric(12,2);
  v_delivery_share numeric(12,2);
  v_customer_service_fee numeric(12,2);
  v_transaction_fee numeric(12,2);
  v_vat numeric(12,2);
  v_customer_total numeric(12,2);
  v_restaurant_gross numeric(12,2);
  v_restaurant_net numeric(12,2);
  v_base numeric;
  v_price_per_km numeric;
  v_min_fee numeric;
  v_max_fee numeric;
  v_free_threshold numeric;
  v_minimum_order numeric;
  v_commission_base_amount numeric;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0
     OR p_distance_meters <= 0 THEN
    RAISE EXCEPTION 'Cart items and a trusted route distance are required.' USING ERRCODE = '22023';
  END IF;
  v_delivery := v_rules->'delivery';
  v_commission := v_rules->'commission';
  v_taxes := v_rules->'taxes_fees';

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_id := COALESCE(v_item->>'menu_item_id', v_item->>'id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::integer, 0);
    IF v_quantity < 1 OR v_quantity > 99 THEN
      RAISE EXCEPTION 'Cart item quantity is invalid.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_menu_item FROM public.menu_items
    WHERE id = v_item_id AND restaurant_id = p_restaurant_id AND is_available = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A cart item is unavailable or belongs to another restaurant.' USING ERRCODE = '55006';
    END IF;
    v_subtotal := v_subtotal + round(v_menu_item.price * v_quantity, 2);
    v_items_snapshot := v_items_snapshot || jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_menu_item.id, 'name', v_menu_item.name,
      'unit_price', v_menu_item.price, 'quantity', v_quantity,
      'notes', NULLIF(v_item->>'notes', '')
    ));
  END LOOP;

  v_minimum_order := COALESCE((v_delivery->>'minimum_order')::numeric, 0);
  IF v_subtotal < v_minimum_order THEN
    RAISE EXCEPTION 'Order subtotal is below the restaurant minimum.' USING ERRCODE = '22023';
  END IF;
  IF v_distance_km > COALESCE((v_delivery->>'max_delivery_km')::numeric, 10) THEN
    RAISE EXCEPTION 'Delivery address is outside this restaurant delivery zone.' USING ERRCODE = '22023';
  END IF;

  v_base := COALESCE((v_delivery->>'base_fee')::numeric, 0);
  v_price_per_km := COALESCE((v_delivery->>'price_per_km')::numeric, 63);
  v_min_fee := COALESCE((v_delivery->>'min_fee')::numeric, 100);
  v_max_fee := COALESCE((v_delivery->>'max_fee')::numeric, 500);
  v_free_threshold := COALESCE((v_delivery->>'free_delivery_threshold')::numeric, 0);
  IF v_free_threshold > 0 AND v_subtotal >= v_free_threshold THEN
    v_delivery_fee := 0;
  ELSE
    v_delivery_fee := greatest(v_base + (v_distance_km * v_price_per_km), v_min_fee);
    IF v_max_fee > 0 THEN v_delivery_fee := least(v_delivery_fee, v_max_fee); END IF;
    v_delivery_fee := round(v_delivery_fee, 2);
  END IF;

  v_commission_base_amount := CASE
    WHEN v_commission->>'commission_base' = 'food_plus_delivery'
      THEN v_subtotal + v_delivery_fee ELSE v_subtotal END;
  v_food_commission := round(v_commission_base_amount * COALESCE((v_commission->>'food_commission_rate')::numeric, 0), 2);
  v_delivery_share := round(v_delivery_fee * COALESCE((v_commission->>'delivery_share_rate')::numeric, 0), 2);
  v_customer_service_fee := round(v_subtotal * COALESCE((v_commission->>'service_fee_rate')::numeric, 0.01), 2);
  v_transaction_fee := round(
    COALESCE((v_taxes->>'transaction_fee_fixed')::numeric, 0)
    + ((v_subtotal + v_delivery_fee) * COALESCE((v_taxes->>'transaction_fee_percent')::numeric, 0)), 2
  );
  v_vat := round(
    (v_subtotal + v_delivery_fee + v_customer_service_fee + v_transaction_fee)
    * COALESCE((v_taxes->>'vat_rate')::numeric, 0), 2
  );
  v_customer_total := v_subtotal + v_delivery_fee + v_customer_service_fee + v_transaction_fee + v_vat;
  v_restaurant_gross := v_subtotal + v_delivery_fee;
  v_restaurant_net := v_restaurant_gross - v_food_commission - v_delivery_share;

  RETURN jsonb_build_object(
    'items', v_items_snapshot,
    'subtotal', v_subtotal,
    'discounts', 0,
    'delivery_fee', v_delivery_fee,
    'customer_service_fee', v_customer_service_fee,
    'transaction_fee', v_transaction_fee,
    'vat', v_vat,
    'service_fee', v_customer_service_fee + v_transaction_fee + v_vat,
    'food_commission_amount', v_food_commission,
    'delivery_share_amount', v_delivery_share,
    'platform_commission', v_food_commission + v_delivery_share,
    'restaurant_gross_amount', v_restaurant_gross,
    'restaurant_net_amount', v_restaurant_net,
    'driver_allocation', 0,
    'total', v_customer_total,
    'currency', 'DZD',
    'distance_meters', p_distance_meters,
    'distance_km', v_distance_km,
    'commercial_term_id', v_commission->>'commercial_term_id',
    'commercial_term_version', (v_commission->>'commercial_term_version')::integer,
    'food_commission_rate', (v_commission->>'food_commission_rate')::numeric,
    'delivery_share_rate', (v_commission->>'delivery_share_rate')::numeric,
    'commission_base', v_commission->>'commission_base',
    'rule_snapshot', v_rules,
    'rule_fingerprint', md5(v_rules::text),
    'calculated_at', now()
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.calculate_marketplace_order_financials(uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_marketplace_order_financials(uuid, jsonb, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.quote_delivery_order_by_route(
  p_route_quote_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote public.delivery_route_quotes%ROWTYPE;
  v_finance jsonb;
BEGIN
  SELECT * INTO v_quote FROM public.delivery_route_quotes
  WHERE id = p_route_quote_id AND customer_id = auth.uid()
    AND consumed_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery route quote is missing or expired. Recalculate delivery.' USING ERRCODE = '22023';
  END IF;
  v_finance := public.calculate_marketplace_order_financials(
    v_quote.restaurant_id, p_items, v_quote.distance_meters
  );
  RETURN v_finance || jsonb_build_object(
    'route_quote_id', v_quote.id,
    'restaurant_id', v_quote.restaurant_id,
    'duration_minutes', ceil(v_quote.duration_seconds / 60.0),
    'route_provider', v_quote.provider,
    'route_expires_at', v_quote.expires_at
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.quote_delivery_order_by_route(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_delivery_order_by_route(uuid, jsonb) TO authenticated;

-- Historical orders keep their original values; new orders receive immutable snapshots.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash_on_delivery',
  ADD COLUMN IF NOT EXISTS route_quote_id uuid REFERENCES public.delivery_route_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS route_provider text,
  ADD COLUMN IF NOT EXISTS route_distance_meters integer,
  ADD COLUMN IF NOT EXISTS route_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS commercial_term_id uuid REFERENCES public.restaurant_commercial_terms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financial_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS financial_calculated_at timestamptz;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS modifier_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.financial_ledger
  ADD COLUMN IF NOT EXISTS commercial_term_id uuid REFERENCES public.restaurant_commercial_terms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS financial_snapshot jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_valid') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_valid
      CHECK (payment_method IN ('cash_on_delivery','online_future')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_route_distance_valid') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_route_distance_valid
      CHECK (route_distance_meters IS NULL OR route_distance_meters > 0) NOT VALID;
  END IF;
END;
$$;

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
BEGIN
  RAISE EXCEPTION 'A server-authoritative road route is required. Recalculate delivery.'
    USING ERRCODE = '55000',
          DETAIL = 'Use /api/delivery-route and quote_delivery_order_by_route.';
END;
$$;

CREATE TABLE IF NOT EXISTS public.order_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.create_order_with_items(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id uuid := auth.uid();
  v_restaurant_id uuid := (p_payload->>'restaurant_id')::uuid;
  v_route_quote_id uuid := (p_payload->>'route_quote_id')::uuid;
  v_items jsonb := p_payload->'items';
  v_idempotency_key text := p_payload->>'idempotency_key';
  v_delivery_address text := COALESCE(p_payload->>'delivery_address', '');
  v_delivery_phone text := COALESCE(p_payload->>'delivery_phone', '');
  v_quote public.delivery_route_quotes%ROWTYPE;
  v_restaurant public.restaurants%ROWTYPE;
  v_finance jsonb;
  v_order_id uuid;
  v_snapshot_item jsonb;
  v_existing public.orders%ROWTYPE;
BEGIN
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'Sign in to place an order.' USING ERRCODE = '42501'; END IF;
  IF v_restaurant_id IS NULL OR v_route_quote_id IS NULL
     OR v_idempotency_key IS NULL OR length(v_idempotency_key) < 8
     OR length(trim(v_delivery_address)) < 5 OR length(trim(v_delivery_phone)) < 6 THEN
    RAISE EXCEPTION 'Restaurant, route quote, idempotency key, phone, and address are required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.orders
  WHERE customer_id = v_customer_id AND restaurant_id = v_restaurant_id
    AND idempotency_key = v_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id', v_existing.id, 'subtotal', v_existing.subtotal,
      'delivery_fee', v_existing.delivery_fee, 'service_fee', v_existing.service_fee,
      'total', v_existing.total, 'idempotent_replay', true
    );
  END IF;

  SELECT * INTO v_restaurant FROM public.restaurants
  WHERE id = v_restaurant_id AND status = 'published'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant is not currently accepting orders.' USING ERRCODE = '55006'; END IF;

  SELECT * INTO v_quote FROM public.delivery_route_quotes
  WHERE id = v_route_quote_id AND customer_id = v_customer_id
    AND restaurant_id = v_restaurant_id AND consumed_at IS NULL AND expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery route quote is missing, expired, or already used.' USING ERRCODE = '22023';
  END IF;

  v_finance := public.calculate_marketplace_order_financials(
    v_restaurant_id, v_items, v_quote.distance_meters
  );

  INSERT INTO public.orders (
    customer_id, restaurant_id, status, idempotency_key,
    subtotal, delivery_fee, service_fee, total,
    delivery_address, delivery_phone, delivery_latitude, delivery_longitude,
    delivery_accuracy_m, delivery_place_id, delivery_location_source,
    delivery_commune, delivery_wilaya, delivery_postal_code,
    delivery_building, delivery_floor, delivery_apartment, delivery_entrance,
    delivery_landmark, delivery_instructions, delivery_distance_km,
    delivery_duration_minutes, delivery_quoted_at, notes,
    payment_method, route_quote_id, route_provider, route_distance_meters,
    route_duration_seconds, commercial_term_id, financial_snapshot,
    financial_calculated_at
  ) VALUES (
    v_customer_id, v_restaurant_id, 'pending', v_idempotency_key,
    (v_finance->>'subtotal')::numeric, (v_finance->>'delivery_fee')::numeric,
    (v_finance->>'service_fee')::numeric, (v_finance->>'total')::numeric,
    v_delivery_address, v_delivery_phone,
    v_quote.destination_latitude, v_quote.destination_longitude,
    NULLIF(p_payload->>'delivery_accuracy_m','')::numeric,
    NULLIF(p_payload->>'delivery_place_id',''), NULLIF(p_payload->>'delivery_location_source',''),
    NULLIF(p_payload->>'delivery_commune',''), NULLIF(p_payload->>'delivery_wilaya',''),
    NULLIF(p_payload->>'delivery_postal_code',''), NULLIF(p_payload->>'delivery_building',''),
    NULLIF(p_payload->>'delivery_floor',''), NULLIF(p_payload->>'delivery_apartment',''),
    NULLIF(p_payload->>'delivery_entrance',''), NULLIF(p_payload->>'delivery_landmark',''),
    NULLIF(p_payload->>'delivery_instructions',''), round(v_quote.distance_meters::numeric / 1000, 2),
    ceil(v_quote.duration_seconds / 60.0), now(), NULLIF(p_payload->>'notes',''),
    'cash_on_delivery', v_quote.id, v_quote.provider, v_quote.distance_meters,
    v_quote.duration_seconds, (v_finance->>'commercial_term_id')::uuid,
    v_finance || jsonb_build_object(
      'customer_coordinates', jsonb_build_object('latitude', v_quote.destination_latitude, 'longitude', v_quote.destination_longitude),
      'restaurant_coordinates', jsonb_build_object('latitude', v_quote.origin_latitude, 'longitude', v_quote.origin_longitude),
      'route_quote_id', v_quote.id, 'route_provider', v_quote.provider,
      'route_duration_seconds', v_quote.duration_seconds
    ),
    now()
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.order_status_transitions (
    order_id, from_status, to_status, actor_id, actor_role, reason
  ) VALUES (
    v_order_id, NULL, 'pending', v_customer_id, 'customer', 'Cash on Delivery order placed'
  );

  FOR v_snapshot_item IN SELECT * FROM jsonb_array_elements(v_finance->'items') LOOP
    INSERT INTO public.order_items (
      order_id, menu_item_id, name, quantity, unit_price, notes, item_snapshot
    ) VALUES (
      v_order_id, (v_snapshot_item->>'menu_item_id')::uuid,
      v_snapshot_item->>'name', (v_snapshot_item->>'quantity')::integer,
      (v_snapshot_item->>'unit_price')::numeric, NULLIF(v_snapshot_item->>'notes',''),
      v_snapshot_item
    );
  END LOOP;

  INSERT INTO public.financial_ledger (
    order_id, restaurant_id, customer_id, order_total, subtotal, delivery_fee,
    service_fee, platform_commission, platform_fee, restaurant_payout,
    delivery_fee_allocation, settlement_status, locked_at, metadata,
    commercial_term_id, financial_snapshot
  ) VALUES (
    v_order_id, v_restaurant_id, v_customer_id,
    (v_finance->>'total')::numeric, (v_finance->>'subtotal')::numeric,
    (v_finance->>'delivery_fee')::numeric, (v_finance->>'service_fee')::numeric,
    (v_finance->>'platform_commission')::numeric,
    (v_finance->>'customer_service_fee')::numeric,
    (v_finance->>'restaurant_net_amount')::numeric,
    (v_finance->>'delivery_fee')::numeric - (v_finance->>'delivery_share_amount')::numeric,
    'pending', now(),
    jsonb_build_object(
      'source', 'authoritative_cod_order', 'idempotency_key', v_idempotency_key,
      'route_quote_id', v_quote.id, 'route_provider', v_quote.provider,
      'rule_fingerprint', v_finance->>'rule_fingerprint'
    ),
    (v_finance->>'commercial_term_id')::uuid, v_finance
  );

  UPDATE public.delivery_route_quotes SET consumed_at = now() WHERE id = v_quote.id;
  PERFORM public.log_activity(
    'order_created', 'order', v_order_id,
    jsonb_build_object(
      'restaurant_id', v_restaurant_id, 'total', v_finance->>'total',
      'route_quote_id', v_quote.id, 'route_distance_meters', v_quote.distance_meters,
      'commercial_term_id', v_finance->>'commercial_term_id',
      'rule_fingerprint', v_finance->>'rule_fingerprint',
      'payment_method', 'cash_on_delivery'
    )
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'subtotal', v_finance->>'subtotal',
    'delivery_fee', v_finance->>'delivery_fee',
    'service_fee', v_finance->>'service_fee', 'total', v_finance->>'total',
    'distance_km', v_finance->>'distance_km',
    'duration_minutes', ceil(v_quote.duration_seconds / 60.0),
    'payment_method', 'cash_on_delivery'
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing FROM public.orders
    WHERE customer_id = v_customer_id AND restaurant_id = v_restaurant_id
      AND idempotency_key = v_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_id', v_existing.id, 'subtotal', v_existing.subtotal,
        'delivery_fee', v_existing.delivery_fee, 'service_fee', v_existing.service_fee,
        'total', v_existing.total, 'idempotent_replay', true
      );
    END IF;
    RAISE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_with_items(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_order_with_items(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_customer public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = NEW.restaurant_id;
  SELECT * INTO v_customer FROM public.profiles WHERE id = NEW.customer_id;
  PERFORM public.notify_user(
    v_restaurant.owner_id, 'new_order', 'New Cash on Delivery order',
    '#' || substr(NEW.id::text, 1, 8) || ' · ' || COALESCE(v_customer.full_name, v_customer.email) || ' · ' || NEW.total::text || ' DZD',
    jsonb_build_object('order_id', NEW.id, 'customer_name', COALESCE(v_customer.full_name, v_customer.email), 'total', NEW.total, 'delivery_address', NEW.delivery_address)
  );
  PERFORM public.notify_user(
    NEW.customer_id, 'order_placed', 'Order placed',
    '#' || substr(NEW.id::text, 1, 8) || ' · ' || v_restaurant.name || ' · Cash on Delivery',
    jsonb_build_object('order_id', NEW.id, 'status', 'pending', 'total', NEW.total, 'payment_method', 'cash_on_delivery')
  );
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.order_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_status_transitions_timeline
  ON public.order_status_transitions(order_id, created_at);
ALTER TABLE public.order_status_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_status_transitions_select_scoped ON public.order_status_transitions;
CREATE POLICY order_status_transitions_select_scoped ON public.order_status_transitions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders order_row
    WHERE order_row.id = order_id
      AND (
        order_row.customer_id = auth.uid()
        OR public.can_manage_restaurant(order_row.restaurant_id)
        OR public.is_super_admin()
      )
  ));

ALTER TABLE public.financial_ledger
  ADD COLUMN IF NOT EXISTS accounting_status text NOT NULL DEFAULT 'pending';
CREATE OR REPLACE FUNCTION public.guard_locked_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL AND (
    NEW.order_id IS DISTINCT FROM OLD.order_id
    OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.order_total IS DISTINCT FROM OLD.order_total
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
    OR NEW.service_fee IS DISTINCT FROM OLD.service_fee
    OR NEW.platform_commission IS DISTINCT FROM OLD.platform_commission
    OR NEW.platform_fee IS DISTINCT FROM OLD.platform_fee
    OR NEW.restaurant_payout IS DISTINCT FROM OLD.restaurant_payout
    OR NEW.delivery_fee_allocation IS DISTINCT FROM OLD.delivery_fee_allocation
    OR NEW.commercial_term_id IS DISTINCT FROM OLD.commercial_term_id
    OR NEW.financial_snapshot IS DISTINCT FROM OLD.financial_snapshot
    OR NEW.locked_at IS DISTINCT FROM OLD.locked_at
  ) THEN
    RAISE EXCEPTION 'Locked financial amounts and snapshots are immutable.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
UPDATE public.financial_ledger
SET locked_at = COALESCE(locked_at, created_at)
WHERE locked_at IS NULL;
UPDATE public.financial_ledger ledger
SET accounting_status = CASE order_row.status::text
  WHEN 'delivered' THEN 'earned'
  WHEN 'cancelled' THEN 'void'
  WHEN 'failed_delivery' THEN 'void'
  WHEN 'refunded' THEN 'void'
  ELSE 'pending'
END
FROM public.orders order_row
WHERE order_row.id = ledger.order_id AND ledger.accounting_status = 'pending';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financial_ledger_accounting_status_valid') THEN
    ALTER TABLE public.financial_ledger ADD CONSTRAINT financial_ledger_accounting_status_valid
      CHECK (accounting_status IN ('pending','earned','void','disputed','settled')) NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id uuid,
  p_target_status public.order_status,
  p_reason text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_old_status public.order_status;
  v_allowed boolean;
  v_actor_role text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002'; END IF;
  IF NOT (
    public.is_super_admin()
    OR public.can_manage_restaurant(v_order.restaurant_id)
    OR (v_order.customer_id = auth.uid() AND v_order.status = 'pending' AND p_target_status = 'cancelled')
    OR EXISTS (
      SELECT 1 FROM public.deliveries delivery
      JOIN public.drivers driver ON driver.id = delivery.driver_id
      WHERE delivery.order_id = v_order.id AND driver.user_id = auth.uid()
        AND delivery.status IN ('picked_up','en_route','arrived','delivered','failed')
        AND p_target_status IN ('delivered','failed_delivery')
    )
  ) THEN
    RAISE EXCEPTION 'You cannot change this order.' USING ERRCODE = '42501';
  END IF;
  IF p_expected_updated_at IS NOT NULL AND v_order.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'This order changed in another session. Reload before acting.' USING ERRCODE = '40001';
  END IF;

  v_allowed :=
    (v_order.status = 'pending' AND p_target_status IN ('accepted','cancelled'))
    OR (v_order.status = 'accepted' AND p_target_status IN ('preparing','cancelled'))
    OR (v_order.status = 'preparing' AND p_target_status IN ('out_for_delivery','cancelled'))
    OR (v_order.status = 'out_for_delivery' AND p_target_status IN ('delivered','failed_delivery','cancelled'))
    OR (v_order.status IN ('delivered','cancelled','failed_delivery') AND p_target_status = 'refunded');
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid order transition: % -> %', v_order.status, p_target_status USING ERRCODE = '22023';
  END IF;
  IF p_target_status IN ('cancelled','failed_delivery','refunded')
     AND length(trim(COALESCE(p_reason,''))) < 3 THEN
    RAISE EXCEPTION 'A clear reason is required for this order transition.' USING ERRCODE = '22023';
  END IF;

  v_actor_role := CASE
    WHEN public.is_super_admin() THEN 'super_admin'
    WHEN v_order.customer_id = auth.uid() THEN 'customer'
    WHEN EXISTS (
      SELECT 1 FROM public.deliveries delivery
      JOIN public.drivers driver ON driver.id = delivery.driver_id
      WHERE delivery.order_id = v_order.id AND driver.user_id = auth.uid()
    ) THEN 'driver'
    ELSE 'restaurant'
  END;
  v_old_status := v_order.status;
  PERFORM set_config('kiyo.domain_order_transition', 'allowed', true);
  UPDATE public.orders SET status = p_target_status, updated_at = now()
  WHERE id = p_order_id RETURNING * INTO v_order;

  INSERT INTO public.order_status_transitions (
    order_id, from_status, to_status, actor_id, actor_role, reason
  ) VALUES (
    p_order_id, v_old_status,
    p_target_status, auth.uid(), v_actor_role, NULLIF(trim(p_reason), '')
  );

  UPDATE public.financial_ledger
  SET accounting_status = CASE
        WHEN p_target_status = 'delivered' THEN 'earned'
        WHEN p_target_status IN ('cancelled','failed_delivery','refunded')
          THEN CASE WHEN accounting_status = 'settled' THEN 'disputed' ELSE 'void' END
        ELSE accounting_status
      END,
      metadata = metadata || jsonb_build_object(
        'last_order_status', p_target_status, 'last_status_reason', p_reason,
        'last_status_changed_at', now()
      )
  WHERE order_id = p_order_id;
  RETURN v_order;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.transition_order_status(uuid, public.order_status, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid, public.order_status, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_order_domain_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND current_setting('kiyo.domain_order_transition', true) IS DISTINCT FROM 'allowed' THEN
    RAISE EXCEPTION 'Order status must use the canonical transition service.' USING ERRCODE = '42501';
  END IF;
  IF (
    NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
    OR NEW.service_fee IS DISTINCT FROM OLD.service_fee
    OR NEW.total IS DISTINCT FROM OLD.total
    OR NEW.financial_snapshot IS DISTINCT FROM OLD.financial_snapshot
    OR NEW.commercial_term_id IS DISTINCT FROM OLD.commercial_term_id
    OR NEW.route_quote_id IS DISTINCT FROM OLD.route_quote_id
  ) THEN
    RAISE EXCEPTION 'Order identity and financial snapshots are immutable.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_order_domain_updates ON public.orders;
CREATE TRIGGER trg_guard_order_domain_updates
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_domain_updates();

DROP POLICY IF EXISTS orders_update_restaurant_or_admin ON public.orders;

CREATE OR REPLACE FUNCTION public.transition_delivery_status(
  p_delivery_id uuid,
  p_target_status text,
  p_reason text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery public.deliveries%ROWTYPE;
  v_driver_user_id uuid;
  v_allowed boolean;
BEGIN
  SELECT delivery.* INTO v_delivery
  FROM public.deliveries delivery
  WHERE delivery.id = p_delivery_id
  FOR UPDATE OF delivery;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found.' USING ERRCODE = 'P0002'; END IF;

  SELECT driver.user_id INTO v_driver_user_id
  FROM public.drivers driver
  WHERE driver.id = v_delivery.driver_id;

  IF NOT public.is_super_admin() AND v_driver_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'This delivery is not assigned to you.' USING ERRCODE = '42501';
  END IF;
  IF p_expected_updated_at IS NOT NULL AND v_delivery.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'This delivery changed in another session. Reload before acting.' USING ERRCODE = '40001';
  END IF;
  v_allowed :=
    (v_delivery.status = 'assigned' AND p_target_status IN ('driver_accepted','driver_declined'))
    OR (v_delivery.status = 'driver_accepted' AND p_target_status = 'picking_up')
    OR (v_delivery.status = 'picking_up' AND p_target_status = 'picked_up')
    OR (v_delivery.status = 'picked_up' AND p_target_status = 'en_route')
    OR (v_delivery.status = 'en_route' AND p_target_status = 'arrived')
    OR (v_delivery.status = 'arrived' AND p_target_status IN ('delivered','failed'));
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid delivery transition: % -> %', v_delivery.status, p_target_status USING ERRCODE = '22023';
  END IF;
  IF p_target_status = 'failed' AND length(trim(COALESCE(p_reason,''))) < 3 THEN
    RAISE EXCEPTION 'A delivery failure reason is required.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.deliveries
  SET status = p_target_status,
      pickup_at = CASE WHEN p_target_status = 'picking_up' THEN COALESCE(pickup_at, now()) ELSE pickup_at END,
      picked_up_at = CASE WHEN p_target_status = 'picked_up' THEN COALESCE(picked_up_at, now()) ELSE picked_up_at END,
      delivered_at = CASE WHEN p_target_status = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
      driver_notes = CASE WHEN p_target_status = 'failed' THEN NULLIF(trim(p_reason), '') ELSE driver_notes END,
      updated_at = now()
  WHERE id = p_delivery_id
  RETURNING * INTO v_delivery;

  IF p_target_status = 'delivered' THEN
    PERFORM public.transition_order_status(v_delivery.order_id, 'delivered', 'Driver confirmed delivery', NULL);
  ELSIF p_target_status = 'failed' THEN
    PERFORM public.transition_order_status(v_delivery.order_id, 'failed_delivery', p_reason, NULL);
  END IF;
  PERFORM public.log_activity(
    'admin_action', 'delivery', p_delivery_id,
    jsonb_build_object(
      'action', 'delivery_status_transition', 'to', p_target_status,
      'order_id', v_delivery.order_id, 'reason', p_reason
    )
  );
  RETURN v_delivery;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.transition_delivery_status(uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_delivery_status(uuid, text, text, timestamptz) TO authenticated;

DROP POLICY IF EXISTS deliveries_update ON public.deliveries;

CREATE OR REPLACE FUNCTION public.force_close_order(
  p_order_id uuid,
  p_new_status text,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can override an order.' USING ERRCODE = '42501';
  END IF;
  PERFORM public.transition_order_status(
    p_order_id, p_new_status::public.order_status,
    COALESCE(NULLIF(trim(p_reason), ''), 'Platform owner override'), NULL
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.force_close_order(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.force_close_order(uuid, text, text) TO authenticated;

COMMIT;
