-- Complete the existing menu modifier model and make all customization
-- validation and pricing authoritative at quote and order time.
BEGIN;

ALTER TABLE public.menu_item_modifiers
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.modifier_options
  ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'menu_item_modifiers_selection_limits_valid'
      AND conrelid = 'public.menu_item_modifiers'::regclass
  ) THEN
    ALTER TABLE public.menu_item_modifiers
      ADD CONSTRAINT menu_item_modifiers_selection_limits_valid
      CHECK (
        min_select >= 0
        AND (max_select IS NULL OR max_select >= min_select)
        AND (is_multiple OR COALESCE(max_select, 1) <= 1)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'modifier_options_price_non_negative'
      AND conrelid = 'public.modifier_options'::regclass
  ) THEN
    ALTER TABLE public.modifier_options
      ADD CONSTRAINT modifier_options_price_non_negative
      CHECK (price_adjustion BETWEEN 0 AND 1000000) NOT VALID;
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS idx_menu_item_modifiers_customer_lookup
  ON public.menu_item_modifiers (menu_item_id, is_active, position);
CREATE INDEX IF NOT EXISTS idx_modifier_options_customer_lookup
  ON public.modifier_options (modifier_id, is_available, position);

DROP POLICY IF EXISTS modifiers_select ON public.menu_item_modifiers;
CREATE POLICY modifiers_select
  ON public.menu_item_modifiers
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.menu_items item
      JOIN public.restaurants restaurant ON restaurant.id = item.restaurant_id
      WHERE item.id = menu_item_modifiers.menu_item_id
        AND (
          (
            restaurant.status = 'published'
            AND item.is_available
            AND menu_item_modifiers.is_active
          )
          OR public.can_manage_restaurant(item.restaurant_id)
        )
    )
  );

DROP POLICY IF EXISTS options_select ON public.modifier_options;
CREATE POLICY options_select
  ON public.modifier_options
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.menu_item_modifiers modifier
      JOIN public.menu_items item ON item.id = modifier.menu_item_id
      JOIN public.restaurants restaurant ON restaurant.id = item.restaurant_id
      WHERE modifier.id = modifier_options.modifier_id
        AND (
          (
            restaurant.status = 'published'
            AND item.is_available
            AND modifier.is_active
            AND modifier_options.is_available
          )
          OR public.can_manage_restaurant(item.restaurant_id)
        )
    )
  );

GRANT SELECT ON public.menu_item_modifiers, public.modifier_options
  TO anon, authenticated;

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
AS $function$
DECLARE
  v_rules jsonb := public.resolve_marketplace_rules(p_restaurant_id);
  v_delivery jsonb;
  v_commission jsonb;
  v_taxes jsonb;
  v_item jsonb;
  v_menu_item public.menu_items%ROWTYPE;
  v_modifier public.menu_item_modifiers%ROWTYPE;
  v_item_id uuid;
  v_quantity integer;
  v_notes text;
  v_selected_ids uuid[];
  v_selected_count integer;
  v_valid_selected_count integer;
  v_group_count integer;
  v_group_minimum integer;
  v_group_maximum integer;
  v_modifier_total numeric(12,2);
  v_unit_price numeric(12,2);
  v_modifier_snapshot jsonb;
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
  v_total_quantity integer := 0;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 100
     OR p_distance_meters <= 0 THEN
    RAISE EXCEPTION 'Cart items and a trusted route distance are required.'
      USING ERRCODE = '22023';
  END IF;

  v_delivery := v_rules->'delivery';
  v_commission := v_rules->'commission';
  v_taxes := v_rules->'taxes_fees';

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Every cart item must be a structured object.'
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      v_item_id := COALESCE(v_item->>'menu_item_id', v_item->>'id')::uuid;
      v_quantity := COALESCE((v_item->>'quantity')::integer, 0);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'A cart item identifier or quantity is invalid.'
        USING ERRCODE = '22023';
    END;

    IF v_quantity < 1 OR v_quantity > 99 THEN
      RAISE EXCEPTION 'Cart item quantity is invalid.' USING ERRCODE = '22023';
    END IF;
    v_total_quantity := v_total_quantity + v_quantity;
    IF v_total_quantity > 200 THEN
      RAISE EXCEPTION 'The cart contains too many items.'
        USING ERRCODE = '22023';
    END IF;

    v_notes := NULLIF(btrim(COALESCE(v_item->>'notes', '')), '');
    IF length(COALESCE(v_notes, '')) > 500 THEN
      RAISE EXCEPTION 'Item instructions must be 500 characters or fewer.'
        USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_menu_item
    FROM public.menu_items
    WHERE id = v_item_id
      AND restaurant_id = p_restaurant_id
      AND is_available = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A cart item is unavailable or belongs to another restaurant.'
        USING ERRCODE = '55006';
    END IF;

    IF v_item ? 'selected_option_ids'
       AND jsonb_typeof(v_item->'selected_option_ids') <> 'array' THEN
      RAISE EXCEPTION 'Selected menu options must be an array.'
        USING ERRCODE = '22023';
    END IF;

    BEGIN
      SELECT COALESCE(array_agg(option_id), ARRAY[]::uuid[])
      INTO v_selected_ids
      FROM (
        SELECT value::uuid AS option_id
        FROM jsonb_array_elements_text(
          COALESCE(v_item->'selected_option_ids', '[]'::jsonb)
        )
      ) selected;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'A selected menu option is invalid.'
        USING ERRCODE = '22023';
    END;

    v_selected_count := COALESCE(cardinality(v_selected_ids), 0);
    IF v_selected_count > 50 THEN
      RAISE EXCEPTION 'Too many menu options were selected.'
        USING ERRCODE = '22023';
    END IF;
    IF v_selected_count <> (
      SELECT count(DISTINCT selected_id)
      FROM unnest(v_selected_ids) selected_id
    ) THEN
      RAISE EXCEPTION 'A menu option cannot be selected more than once.'
        USING ERRCODE = '22023';
    END IF;

    SELECT count(*)
    INTO v_valid_selected_count
    FROM public.modifier_options option
    JOIN public.menu_item_modifiers modifier ON modifier.id = option.modifier_id
    WHERE option.id = ANY(v_selected_ids)
      AND option.is_available
      AND modifier.is_active
      AND modifier.menu_item_id = v_item_id;
    IF v_valid_selected_count <> v_selected_count THEN
      RAISE EXCEPTION 'A selected option is unavailable or does not belong to this dish.'
        USING ERRCODE = '55006';
    END IF;

    FOR v_modifier IN
      SELECT *
      FROM public.menu_item_modifiers
      WHERE menu_item_id = v_item_id AND is_active
      ORDER BY position, id
    LOOP
      SELECT count(*)
      INTO v_group_count
      FROM public.modifier_options option
      WHERE option.modifier_id = v_modifier.id
        AND option.id = ANY(v_selected_ids)
        AND option.is_available;

      v_group_minimum := greatest(
        COALESCE(v_modifier.min_select, 0),
        CASE WHEN v_modifier.is_required THEN 1 ELSE 0 END
      );
      v_group_maximum := CASE
        WHEN v_modifier.is_multiple
          THEN COALESCE(v_modifier.max_select, 20)
        ELSE 1
      END;

      IF v_group_count < v_group_minimum THEN
        RAISE EXCEPTION 'Complete all required choices for "%".', v_modifier.name
          USING ERRCODE = '22023';
      END IF;
      IF v_group_count > v_group_maximum THEN
        RAISE EXCEPTION 'Too many choices were selected for "%".', v_modifier.name
          USING ERRCODE = '22023';
      END IF;
    END LOOP;

    SELECT
      COALESCE(sum(option.price_adjustion), 0),
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'group_id', modifier.id,
            'group_name', modifier.name,
            'option_id', option.id,
            'option_name', option.name,
            'price_adjustment', option.price_adjustion
          )
          ORDER BY modifier.position, option.position, option.id
        ),
        '[]'::jsonb
      )
    INTO v_modifier_total, v_modifier_snapshot
    FROM public.modifier_options option
    JOIN public.menu_item_modifiers modifier ON modifier.id = option.modifier_id
    WHERE option.id = ANY(v_selected_ids)
      AND option.is_available
      AND modifier.is_active
      AND modifier.menu_item_id = v_item_id;

    v_modifier_total := round(COALESCE(v_modifier_total, 0), 2);
    v_unit_price := round(v_menu_item.price + v_modifier_total, 2);
    v_subtotal := v_subtotal + round(v_unit_price * v_quantity, 2);
    v_items_snapshot := v_items_snapshot || jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_menu_item.id,
      'name', v_menu_item.name,
      'base_unit_price', v_menu_item.price,
      'modifier_total', v_modifier_total,
      'unit_price', v_unit_price,
      'quantity', v_quantity,
      'notes', v_notes,
      'modifiers', v_modifier_snapshot
    ));
  END LOOP;

  v_minimum_order := COALESCE((v_delivery->>'minimum_order')::numeric, 0);
  IF v_subtotal < v_minimum_order THEN
    RAISE EXCEPTION 'Order subtotal is below the restaurant minimum.'
      USING ERRCODE = '22023';
  END IF;
  IF v_distance_km > COALESCE((v_delivery->>'max_delivery_km')::numeric, 10) THEN
    RAISE EXCEPTION 'Delivery address is outside this restaurant delivery zone.'
      USING ERRCODE = '22023';
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
    IF v_max_fee > 0 THEN
      v_delivery_fee := least(v_delivery_fee, v_max_fee);
    END IF;
    v_delivery_fee := round(v_delivery_fee, 2);
  END IF;

  v_commission_base_amount := CASE
    WHEN v_commission->>'commission_base' = 'food_plus_delivery'
      THEN v_subtotal + v_delivery_fee
    ELSE v_subtotal
  END;
  v_food_commission := round(
    v_commission_base_amount
    * COALESCE((v_commission->>'food_commission_rate')::numeric, 0),
    2
  );
  v_delivery_share := round(
    v_delivery_fee * COALESCE((v_commission->>'delivery_share_rate')::numeric, 0),
    2
  );
  v_customer_service_fee := round(
    v_subtotal * COALESCE((v_commission->>'service_fee_rate')::numeric, 0.01),
    2
  );
  v_transaction_fee := round(
    COALESCE((v_taxes->>'transaction_fee_fixed')::numeric, 0)
    + (
      (v_subtotal + v_delivery_fee)
      * COALESCE((v_taxes->>'transaction_fee_percent')::numeric, 0)
    ),
    2
  );
  v_vat := round(
    (v_subtotal + v_delivery_fee + v_customer_service_fee + v_transaction_fee)
    * COALESCE((v_taxes->>'vat_rate')::numeric, 0),
    2
  );
  v_customer_total :=
    v_subtotal + v_delivery_fee + v_customer_service_fee + v_transaction_fee + v_vat;
  v_restaurant_gross := v_subtotal + v_delivery_fee;
  v_restaurant_net :=
    v_restaurant_gross - v_food_commission - v_delivery_share;

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
END
$function$;

REVOKE ALL ON FUNCTION public.calculate_marketplace_order_financials(uuid, jsonb, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_marketplace_order_financials(uuid, jsonb, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.snapshot_order_item_modifiers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  NEW.modifier_snapshot :=
    COALESCE(NEW.item_snapshot->'modifiers', NEW.modifier_snapshot, '[]'::jsonb);
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.snapshot_order_item_modifiers()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS order_items_snapshot_modifiers
  ON public.order_items;
CREATE TRIGGER order_items_snapshot_modifiers
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_order_item_modifiers();

DO $realtime$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'menu_item_modifiers'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.menu_item_modifiers;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'modifier_options'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.modifier_options;
  END IF;
END
$realtime$;

COMMIT;
