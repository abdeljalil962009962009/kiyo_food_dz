-- Rollback-isolated COD lifecycle and settlement acceptance test.
-- Run only in Kiyo Food Staging after migration 0052 succeeds.
BEGIN;

DO $settlement_privileges$
BEGIN
  IF has_function_privilege('anon', 'public.generate_monthly_settlement(uuid,date)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.generate_monthly_settlement(uuid,date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.mark_settlement_paid(uuid,numeric,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.mark_settlement_paid(uuid,numeric,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.generate_monthly_settlement(uuid,date)', 'EXECUTE') THEN
    RAISE EXCEPTION '0052 failed: settlement RPC privilege boundary is incorrect';
  END IF;
END
$settlement_privileges$;

DO $preflight$
DECLARE
  v_admin_id uuid;
  v_restaurant_id uuid;
  v_owner_id uuid;
  v_customer_id uuid;
  v_other_customer_id uuid;
  v_category_id uuid;
  v_item_id uuid;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE role = 'super_admin' AND NOT COALESCE(is_suspended, false)
  ORDER BY created_at LIMIT 1;

  SELECT restaurant.id, membership.user_id
  INTO v_restaurant_id, v_owner_id
  FROM public.restaurants restaurant
  JOIN public.restaurant_memberships membership
    ON membership.restaurant_id = restaurant.id
   AND membership.membership_role = 'owner'
   AND membership.status = 'active'
  WHERE restaurant.status = 'published'
    AND public.kiyo_is_coordinate_in_algeria(
      restaurant.latitude, restaurant.longitude
    )
    AND EXISTS (
      SELECT 1 FROM public.restaurant_commercial_terms terms
      WHERE terms.restaurant_id = restaurant.id
        AND terms.status = 'active'
        AND terms.food_commission_rate > 0
        AND terms.effective_at <= now()
        AND (terms.expires_at IS NULL OR terms.expires_at > now())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.settlements settlement
      WHERE settlement.restaurant_id = restaurant.id
        AND settlement.period_start = DATE '2001-01-01'
    )
  ORDER BY restaurant.created_at
  LIMIT 1;

  SELECT id INTO v_customer_id
  FROM public.profiles
  WHERE role = 'customer' AND NOT COALESCE(is_suspended, false)
    AND id <> v_owner_id
  ORDER BY created_at DESC LIMIT 1;

  SELECT id INTO v_other_customer_id
  FROM public.profiles
  WHERE role = 'customer' AND NOT COALESCE(is_suspended, false)
    AND id NOT IN (v_owner_id, v_customer_id)
  ORDER BY created_at DESC LIMIT 1;

  IF v_admin_id IS NULL OR v_restaurant_id IS NULL OR v_owner_id IS NULL
     OR v_customer_id IS NULL OR v_other_customer_id IS NULL THEN
    RAISE EXCEPTION
      '0052 requires a super admin, two customers, and a published staging restaurant with coordinates, an owner, active positive commercial terms, and no current-month settlement';
  END IF;

  UPDATE public.restaurants
  SET max_delivery_km = 20, min_order_amount = 0
  WHERE id = v_restaurant_id;

  INSERT INTO public.menu_categories (restaurant_id, name, position)
  VALUES (v_restaurant_id, '0052 rollback fixture', 9999)
  RETURNING id INTO v_category_id;

  INSERT INTO public.menu_items (
    restaurant_id, category_id, name, description, price,
    is_available, position
  ) VALUES (
    v_restaurant_id, v_category_id, '0052 COD fixture item',
    'Rollback-only financial acceptance item', 1234, true, 9999
  ) RETURNING id INTO v_item_id;

  PERFORM set_config('kiyo.test.0052.admin_id', v_admin_id::text, true);
  PERFORM set_config('kiyo.test.0052.restaurant_id', v_restaurant_id::text, true);
  PERFORM set_config('kiyo.test.0052.owner_id', v_owner_id::text, true);
  PERFORM set_config('kiyo.test.0052.customer_id', v_customer_id::text, true);
  PERFORM set_config('kiyo.test.0052.other_customer_id', v_other_customer_id::text, true);
  PERFORM set_config('kiyo.test.0052.item_id', v_item_id::text, true);
END
$preflight$;

DO $create_and_transition_orders$
DECLARE
  v_admin_id uuid := current_setting('kiyo.test.0052.admin_id')::uuid;
  v_restaurant_id uuid := current_setting('kiyo.test.0052.restaurant_id')::uuid;
  v_owner_id uuid := current_setting('kiyo.test.0052.owner_id')::uuid;
  v_customer_id uuid := current_setting('kiyo.test.0052.customer_id')::uuid;
  v_item_id uuid := current_setting('kiyo.test.0052.item_id')::uuid;
  v_quote public.delivery_route_quotes%ROWTYPE;
  v_cancel_quote public.delivery_route_quotes%ROWTYPE;
  v_result jsonb;
  v_replay jsonb;
  v_payload jsonb;
  v_cancel_payload jsonb;
  v_order public.orders%ROWTYPE;
  v_cancel_order public.orders%ROWTYPE;
  v_original_subtotal numeric;
  v_original_total numeric;
  v_original_snapshot jsonb;
  v_stale_updated_at timestamptz;
  v_denied boolean;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_id, 'role', 'service_role')::text,
    true
  );
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  v_quote := public.record_trusted_delivery_route(
    v_customer_id, v_restaurant_id, 36.2600, 6.6000,
    3200, 900, '0052-delivered-route'
  );
  v_cancel_quote := public.record_trusted_delivery_route(
    v_customer_id, v_restaurant_id, 36.2700, 6.6100,
    4100, 1100, '0052-cancelled-route'
  );

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_customer_id, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('request.jwt.claim.sub', v_customer_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_payload := jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'route_quote_id', v_quote.id,
    'idempotency_key', '0052-delivered-' || gen_random_uuid()::text,
    'delivery_address', '0052 staging delivery address',
    'delivery_phone', '0550000052',
    'delivery_accuracy_m', 8,
    'delivery_location_source', 'manual',
    'delivery_commune', 'Constantine',
    'delivery_wilaya', 'Constantine',
    'items', jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item_id,
      'quantity', 2,
      'unit_price', 1,
      'client_total', 1
    )),
    'subtotal', 1,
    'delivery_fee', 1,
    'total', 1
  );
  v_result := public.create_order_with_items(v_payload);
  v_replay := public.create_order_with_items(v_payload);

  IF v_result->>'order_id' IS DISTINCT FROM v_replay->>'order_id'
     OR COALESCE((v_replay->>'idempotent_replay')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION '0052 failed: duplicate order replay was not idempotent';
  END IF;

  SELECT * INTO v_order FROM public.orders
  WHERE id = (v_result->>'order_id')::uuid;
  v_original_subtotal := v_order.subtotal;
  v_original_total := v_order.total;
  v_original_snapshot := v_order.financial_snapshot;
  IF v_order.subtotal <> 2468 OR v_order.total = 1
     OR v_order.payment_method <> 'cash_on_delivery'
     OR v_order.route_quote_id <> v_quote.id
     OR v_order.route_distance_meters <> 3200
     OR v_order.commercial_term_id IS NULL
     OR v_order.financial_snapshot IS NULL THEN
    RAISE EXCEPTION '0052 failed: server-authoritative COD snapshot is incomplete or trusted client prices';
  END IF;
  IF (SELECT count(*) FROM public.financial_ledger WHERE order_id = v_order.id) <> 1
     OR (SELECT count(*) FROM public.order_items WHERE order_id = v_order.id) <> 1 THEN
    RAISE EXCEPTION '0052 failed: order, items, and ledger were not created atomically';
  END IF;

  v_denied := false;
  BEGIN
    PERFORM public.create_order_with_items(
      v_payload || jsonb_build_object(
        'idempotency_key', '0052-reused-quote-' || gen_random_uuid()::text
      )
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION '0052 failed: a consumed route quote created a second order';
  END IF;

  v_stale_updated_at := v_order.updated_at;
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_owner_id, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);

  v_denied := false;
  BEGIN
    PERFORM public.transition_order_status(
      v_order.id, 'delivered', NULL, v_stale_updated_at
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION '0052 failed: invalid pending-to-delivered transition succeeded';
  END IF;

  v_order := public.transition_order_status(
    v_order.id, 'accepted', NULL, v_stale_updated_at
  );
  v_denied := false;
  BEGIN
    PERFORM public.transition_order_status(
      v_order.id, 'preparing', NULL, v_stale_updated_at
    );
  EXCEPTION WHEN serialization_failure THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION '0052 failed: stale order version was accepted';
  END IF;
  v_order := public.transition_order_status(
    v_order.id, 'preparing', NULL, v_order.updated_at
  );
  v_order := public.transition_order_status(
    v_order.id, 'out_for_delivery', NULL, v_order.updated_at
  );
  v_order := public.transition_order_status(
    v_order.id, 'delivered', NULL, v_order.updated_at
  );

  IF (SELECT accounting_status FROM public.financial_ledger WHERE order_id = v_order.id) <> 'earned'
     OR (SELECT count(*) FROM public.order_status_transitions WHERE order_id = v_order.id) <> 5 THEN
    RAISE EXCEPTION '0052 failed: delivered order lifecycle or earned accounting state is inconsistent';
  END IF;

  v_denied := false;
  BEGIN
    UPDATE public.orders SET total = total + 1 WHERE id = v_order.id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION '0052 failed: immutable order total was changed';
  END IF;
  v_denied := false;
  BEGIN
    UPDATE public.financial_ledger
    SET order_total = order_total + 1 WHERE order_id = v_order.id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION '0052 failed: locked ledger amount was changed';
  END IF;

  UPDATE public.menu_items SET price = 9999 WHERE id = v_item_id;
  SELECT * INTO v_order FROM public.orders WHERE id = v_order.id;
  IF v_order.subtotal <> v_original_subtotal
     OR v_order.total <> v_original_total
     OR v_order.financial_snapshot <> v_original_snapshot THEN
    RAISE EXCEPTION '0052 failed: later menu changes altered the historical order snapshot';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_customer_id, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('request.jwt.claim.sub', v_customer_id::text, true);
  v_cancel_payload := jsonb_build_object(
    'restaurant_id', v_restaurant_id,
    'route_quote_id', v_cancel_quote.id,
    'idempotency_key', '0052-cancelled-' || gen_random_uuid()::text,
    'delivery_address', '0052 staging cancellation address',
    'delivery_phone', '0550000052',
    'items', jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item_id, 'quantity', 1
    ))
  );
  v_result := public.create_order_with_items(v_cancel_payload);
  v_cancel_order := public.transition_order_status(
    (v_result->>'order_id')::uuid,
    'cancelled',
    'Customer cancelled the rollback-only staging order',
    NULL
  );
  IF (SELECT accounting_status FROM public.financial_ledger WHERE order_id = v_cancel_order.id) <> 'void' THEN
    RAISE EXCEPTION '0052 failed: cancelled COD order did not void its ledger';
  END IF;

  -- Move only the rollback fixtures into a dedicated historical test month so
  -- pre-existing staging orders can never affect the settlement assertions.
  UPDATE public.orders
  SET created_at = TIMESTAMPTZ '2001-01-15 12:00:00+00'
  WHERE id IN (v_order.id, v_cancel_order.id);
  UPDATE public.financial_ledger
  SET created_at = TIMESTAMPTZ '2001-01-15 12:00:00+00',
      accounting_effective_at = TIMESTAMPTZ '2001-01-15 12:00:00+00'
  WHERE order_id IN (v_order.id, v_cancel_order.id);

  PERFORM set_config('kiyo.test.0052.delivered_order_id', v_order.id::text, true);
  PERFORM set_config('kiyo.test.0052.cancelled_order_id', v_cancel_order.id::text, true);
END
$create_and_transition_orders$;

-- A second customer must not see either private order or ledger entry.
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('kiyo.test.0052.other_customer_id'),
    'role', 'authenticated'
  )::text,
  true
);
SELECT set_config(
  'request.jwt.claim.sub',
  current_setting('kiyo.test.0052.other_customer_id'),
  true
);

DO $cross_customer_rls$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE id IN (
      current_setting('kiyo.test.0052.delivered_order_id')::uuid,
      current_setting('kiyo.test.0052.cancelled_order_id')::uuid
    )
  ) OR EXISTS (
    SELECT 1 FROM public.financial_ledger
    WHERE order_id = current_setting('kiyo.test.0052.delivered_order_id')::uuid
  ) THEN
    RAISE EXCEPTION '0052 failed: unrelated customer can read another customer''s order finances';
  END IF;
END
$cross_customer_rls$;

RESET ROLE;

DO $settlement_checks$
DECLARE
  v_admin_id uuid := current_setting('kiyo.test.0052.admin_id')::uuid;
  v_restaurant_id uuid := current_setting('kiyo.test.0052.restaurant_id')::uuid;
  v_delivered_order_id uuid := current_setting('kiyo.test.0052.delivered_order_id')::uuid;
  v_cancelled_order_id uuid := current_setting('kiyo.test.0052.cancelled_order_id')::uuid;
  v_settlement_result jsonb;
  v_overview jsonb;
  v_payment_result jsonb;
  v_settlement public.settlements%ROWTYPE;
  v_half numeric;
  v_denied boolean;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_id, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_overview := public.get_settlement_overview();
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_overview->'eligible_periods') candidate
    WHERE candidate->>'restaurant_id' = v_restaurant_id::text
      AND (candidate->>'period_start')::date = DATE '2001-01-01'
      AND (candidate->>'entry_count')::integer = 1
  ) THEN
    RAISE EXCEPTION '0052 failed: the owner queue did not expose the eligible delivered-order month';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_id, 'role', 'service_role')::text,
    true
  );
  v_settlement_result := public.execute_owner_action(
    v_admin_id,
    '52000000-0000-4000-8000-000000000001'::uuid,
    'generate_monthly_settlement',
    jsonb_build_object(
      'p_restaurant_id', v_restaurant_id,
      'p_period_start', DATE '2001-01-06'
    )
  );
  SELECT * INTO v_settlement FROM public.settlements
  WHERE id = (v_settlement_result->>'settlement_id')::uuid;

  IF (v_settlement_result->>'entry_count')::integer <> 1
     OR v_settlement.period_start <> DATE '2001-01-01'
     OR v_settlement.gross_sales <> (
       SELECT order_total FROM public.financial_ledger
       WHERE order_id = v_delivered_order_id
     )
     OR v_settlement.amount_owed <> (
       SELECT platform_commission + service_fee FROM public.financial_ledger
       WHERE order_id = v_delivered_order_id
     )
     OR (SELECT settlement_id FROM public.financial_ledger WHERE order_id = v_delivered_order_id) <> v_settlement.id
     OR (SELECT settlement_id FROM public.financial_ledger WHERE order_id = v_cancelled_order_id) IS NOT NULL THEN
    RAISE EXCEPTION '0052 failed: settlement included void orders or linked the wrong ledgers';
  END IF;

  v_denied := false;
  BEGIN
    PERFORM public.generate_monthly_settlement(
      v_restaurant_id, DATE '2001-01-01'
    );
  EXCEPTION WHEN unique_violation THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION '0052 failed: duplicate monthly settlement was created';
  END IF;

  v_half := round(v_settlement.balance / 2, 2);
  v_payment_result := public.mark_settlement_paid(
    v_settlement.id, v_half, '0052 rollback-only partial payment'
  );
  IF v_payment_result->>'status' <> 'partially_paid' THEN
    RAISE EXCEPTION '0052 failed: partial settlement payment state is incorrect';
  END IF;

  SELECT * INTO v_settlement FROM public.settlements WHERE id = v_settlement.id;
  v_denied := false;
  BEGIN
    PERFORM public.mark_settlement_paid(
      v_settlement.id, v_settlement.balance + 1, 'invalid overpayment'
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION '0052 failed: settlement overpayment was accepted';
  END IF;

  v_payment_result := public.mark_settlement_paid(
    v_settlement.id, NULL, '0052 rollback-only final payment'
  );
  IF v_payment_result->>'status' <> 'paid'
     OR (SELECT accounting_status FROM public.financial_ledger WHERE order_id = v_delivered_order_id) <> 'settled'
     OR (SELECT settlement_status FROM public.financial_ledger WHERE order_id = v_delivered_order_id) <> 'settled' THEN
    RAISE EXCEPTION '0052 failed: paid settlement did not close its linked ledger';
  END IF;

  PERFORM public.transition_order_status(
    v_delivered_order_id, 'refunded',
    'Refund after settlement must create a dispute', NULL
  );
  IF (SELECT accounting_status FROM public.financial_ledger WHERE order_id = v_delivered_order_id) <> 'disputed'
     OR (SELECT settlement_status FROM public.financial_ledger WHERE order_id = v_delivered_order_id) <> 'disputed'
     OR (SELECT status FROM public.settlements WHERE id = v_settlement.id) <> 'disputed' THEN
    RAISE EXCEPTION '0052 failed: post-settlement refund did not dispute the ledger and settlement';
  END IF;
END
$settlement_checks$;

ROLLBACK;

SELECT '0052 COD order, immutable financial snapshot, settlement, and dispute assertions passed' AS result;
