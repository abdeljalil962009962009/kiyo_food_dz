-- Kiyo Food 0058: final retry for live E2E cleanup with all order-referenced
-- records deleted only after the test order is gone.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS kiyo_0058_cleanup_result (
  cleanup_status text NOT NULL,
  restaurant_ids uuid[] NOT NULL,
  application_ids uuid[] NOT NULL,
  order_ids uuid[] NOT NULL,
  profile_ids uuid[] NOT NULL,
  deleted_counts jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
) ON COMMIT PRESERVE ROWS;

DO $$
DECLARE
  v_restaurant_ids uuid[] := ARRAY[]::uuid[];
  v_application_ids uuid[] := ARRAY[]::uuid[];
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_profile_ids uuid[] := ARRAY[]::uuid[];
  v_count integer := 0;
  v_counts jsonb := '{}'::jsonb;
BEGIN
  SELECT COALESCE(array_agg(DISTINCT r.id), ARRAY[]::uuid[])
  INTO v_restaurant_ids
  FROM public.restaurants r
  WHERE r.id = 'e2d135be-c923-408c-9b87-5aa9f7f77f7c'::uuid
     OR r.name ILIKE 'Kiyo E2E Test Restaurant 20260717%';

  IF EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = ANY(v_restaurant_ids)
      AND r.id <> 'e2d135be-c923-408c-9b87-5aa9f7f77f7c'::uuid
      AND r.name NOT ILIKE 'Kiyo E2E Test Restaurant 20260717%'
  ) THEN
    RAISE EXCEPTION '0058 safety stop: matched restaurant is not an E2E test restaurant.';
  END IF;

  IF COALESCE(array_length(v_restaurant_ids, 1), 0) > 3 THEN
    RAISE EXCEPTION '0058 safety stop: too many restaurants matched.';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT a.id), ARRAY[]::uuid[])
  INTO v_application_ids
  FROM public.restaurant_applications a
  WHERE a.restaurant_id = ANY(v_restaurant_ids)
     OR a.restaurant_name ILIKE 'Kiyo E2E Test Restaurant 20260717%'
     OR a.legal_name = 'Kiyo E2E Test SARL'
     OR a.applicant_id IN (
       SELECT p.id
       FROM public.profiles p
       WHERE p.email ILIKE 'codex.staging.%@example.com'
          OR p.email ILIKE 'codex.test.%@example.com'
     );

  SELECT COALESCE(array_agg(DISTINCT o.id), ARRAY[]::uuid[])
  INTO v_order_ids
  FROM public.orders o
  WHERE o.restaurant_id = ANY(v_restaurant_ids)
     OR o.id::text LIKE '47295206%';

  SELECT COALESCE(array_agg(DISTINCT p.id), ARRAY[]::uuid[])
  INTO v_profile_ids
  FROM public.profiles p
  WHERE p.role <> 'super_admin'
    AND (
      p.id IN (SELECT a.applicant_id FROM public.restaurant_applications a WHERE a.id = ANY(v_application_ids))
      OR p.id IN (SELECT r.owner_id FROM public.restaurants r WHERE r.id = ANY(v_restaurant_ids))
      OR p.id IN (SELECT m.user_id FROM public.restaurant_memberships m WHERE m.restaurant_id = ANY(v_restaurant_ids))
      OR p.id IN (SELECT o.customer_id FROM public.orders o WHERE o.id = ANY(v_order_ids))
      OR p.email ILIKE 'codex.staging.%@example.com'
      OR p.email ILIKE 'codex.test.%@example.com'
      OR p.full_name ILIKE 'Customer Test Account%'
      OR p.full_name ILIKE 'Codex Staging Customer%'
    );

  IF COALESCE(array_length(v_profile_ids, 1), 0) > 12 THEN
    RAISE EXCEPTION '0058 safety stop: too many test profiles matched.';
  END IF;

  IF to_regclass('public.financial_ledger') IS NOT NULL THEN
    DELETE FROM public.financial_ledger
    WHERE order_id = ANY(v_order_ids)
       OR restaurant_id = ANY(v_restaurant_ids)
       OR customer_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('financial_ledger', v_count);
  END IF;

  IF to_regclass('public.settlements') IS NOT NULL THEN
    DELETE FROM public.settlements
    WHERE restaurant_id = ANY(v_restaurant_ids)
       OR created_by = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('settlements', v_count);
  END IF;

  IF to_regclass('public.order_status_transitions') IS NOT NULL THEN
    DELETE FROM public.order_status_transitions
    WHERE order_id = ANY(v_order_ids)
       OR actor_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('order_status_transitions', v_count);
  END IF;

  IF to_regclass('public.deliveries') IS NOT NULL THEN
    DELETE FROM public.deliveries WHERE order_id = ANY(v_order_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('deliveries', v_count);
  END IF;

  IF to_regclass('public.reviews') IS NOT NULL THEN
    DELETE FROM public.reviews
    WHERE order_id = ANY(v_order_ids)
       OR restaurant_id = ANY(v_restaurant_ids)
       OR customer_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('reviews', v_count);
  END IF;

  IF to_regclass('public.order_items') IS NOT NULL THEN
    DELETE FROM public.order_items WHERE order_id = ANY(v_order_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('order_items', v_count);
  END IF;

  IF to_regclass('public.support_messages') IS NOT NULL
     AND to_regclass('public.support_tickets') IS NOT NULL THEN
    DELETE FROM public.support_messages sm
    WHERE sm.sender_id = ANY(v_profile_ids)
       OR sm.ticket_id IN (
         SELECT t.id FROM public.support_tickets t WHERE t.requester_id = ANY(v_profile_ids)
       );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('support_messages', v_count);
  END IF;

  IF to_regclass('public.support_tickets') IS NOT NULL THEN
    DELETE FROM public.support_tickets WHERE requester_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('support_tickets', v_count);
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications
    WHERE user_id = ANY(v_profile_ids)
       OR metadata::text ILIKE ANY(ARRAY[
         '%e2d135be-c923-408c-9b87-5aa9f7f77f7c%',
         '%47295206%',
         '%Kiyo E2E Test Restaurant 20260717%',
         '%E2E Test Pizza%',
         '%E2E Test Burger%'
       ])
       OR title ILIKE '%Kiyo E2E Test%'
       OR body ILIKE '%Kiyo E2E Test%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('notifications', v_count);
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    DELETE FROM public.audit_logs
    WHERE actor_id = ANY(v_profile_ids)
       OR target_id = ANY(v_restaurant_ids)
       OR target_id = ANY(v_application_ids)
       OR target_id = ANY(v_order_ids)
       OR metadata::text ILIKE ANY(ARRAY[
         '%e2d135be-c923-408c-9b87-5aa9f7f77f7c%',
         '%47295206%',
         '%Kiyo E2E Test Restaurant 20260717%'
       ]);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('audit_logs', v_count);
  END IF;

  IF to_regclass('public.owner_action_requests') IS NOT NULL THEN
    DELETE FROM public.owner_action_requests
    WHERE actor_id = ANY(v_profile_ids)
       OR args::text ILIKE ANY(ARRAY['%e2d135be-c923-408c-9b87-5aa9f7f77f7c%', '%47295206%', '%Kiyo E2E Test Restaurant 20260717%']);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('owner_action_requests', v_count);
  END IF;

  IF to_regclass('public.user_action_requests') IS NOT NULL THEN
    DELETE FROM public.user_action_requests
    WHERE actor_id = ANY(v_profile_ids)
       OR args::text ILIKE ANY(ARRAY['%e2d135be-c923-408c-9b87-5aa9f7f77f7c%', '%47295206%', '%Kiyo E2E Test Restaurant 20260717%']);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('user_action_requests', v_count);
  END IF;

  IF to_regclass('public.customer_favorites') IS NOT NULL THEN
    DELETE FROM public.customer_favorites
    WHERE restaurant_id = ANY(v_restaurant_ids)
       OR customer_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('customer_favorites', v_count);
  END IF;

  IF to_regclass('public.saved_addresses') IS NOT NULL THEN
    DELETE FROM public.saved_addresses WHERE customer_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('saved_addresses', v_count);
  END IF;

  IF to_regclass('public.customer_preferences') IS NOT NULL THEN
    DELETE FROM public.customer_preferences WHERE customer_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('customer_preferences', v_count);
  END IF;

  IF to_regclass('public.loyalty_transactions') IS NOT NULL THEN
    DELETE FROM public.loyalty_transactions
    WHERE customer_id = ANY(v_profile_ids)
       OR order_id = ANY(v_order_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('loyalty_transactions', v_count);
  END IF;

  IF to_regclass('public.loyalty_points') IS NOT NULL THEN
    DELETE FROM public.loyalty_points WHERE customer_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('loyalty_points', v_count);
  END IF;

  IF to_regclass('public.recent_orders_summary') IS NOT NULL THEN
    DELETE FROM public.recent_orders_summary
    WHERE restaurant_id = ANY(v_restaurant_ids)
       OR customer_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('recent_orders_summary', v_count);
  END IF;

  IF to_regclass('public.customer_notes') IS NOT NULL THEN
    DELETE FROM public.customer_notes
    WHERE restaurant_id = ANY(v_restaurant_ids)
       OR customer_id = ANY(v_profile_ids)
       OR created_by = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('customer_notes', v_count);
  END IF;

  IF to_regclass('public.customer_recommendations') IS NOT NULL THEN
    DELETE FROM public.customer_recommendations
    WHERE restaurant_id = ANY(v_restaurant_ids)
       OR customer_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('customer_recommendations', v_count);
  END IF;

  IF to_regclass('public.customer_subscriptions') IS NOT NULL THEN
    DELETE FROM public.customer_subscriptions WHERE customer_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('customer_subscriptions', v_count);
  END IF;

  IF to_regclass('public.delivery_zones') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'delivery_zones' AND column_name = 'restaurant_id'
     ) THEN
    EXECUTE 'DELETE FROM public.delivery_zones WHERE restaurant_id = ANY($1)' USING v_restaurant_ids;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('delivery_zones', v_count);
  END IF;

  IF to_regclass('public.restaurant_analytics') IS NOT NULL THEN
    DELETE FROM public.restaurant_analytics WHERE restaurant_id = ANY(v_restaurant_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('restaurant_analytics', v_count);
  END IF;

  IF to_regclass('public.restaurant_special_hours') IS NOT NULL THEN
    DELETE FROM public.restaurant_special_hours WHERE restaurant_id = ANY(v_restaurant_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('restaurant_special_hours', v_count);
  END IF;

  IF to_regclass('public.promotions') IS NOT NULL THEN
    DELETE FROM public.promotions WHERE restaurant_id = ANY(v_restaurant_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('promotions', v_count);
  END IF;

  IF to_regclass('public.modifier_options') IS NOT NULL
     AND to_regclass('public.menu_item_modifiers') IS NOT NULL
     AND to_regclass('public.menu_items') IS NOT NULL THEN
    DELETE FROM public.modifier_options o
    USING public.menu_item_modifiers m, public.menu_items item
    WHERE o.modifier_id = m.id
      AND m.menu_item_id = item.id
      AND item.restaurant_id = ANY(v_restaurant_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('modifier_options', v_count);
  END IF;

  IF to_regclass('public.menu_item_modifiers') IS NOT NULL
     AND to_regclass('public.menu_items') IS NOT NULL THEN
    DELETE FROM public.menu_item_modifiers m
    USING public.menu_items item
    WHERE m.menu_item_id = item.id
      AND item.restaurant_id = ANY(v_restaurant_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('menu_item_modifiers', v_count);
  END IF;

  IF to_regclass('public.menu_items') IS NOT NULL THEN
    DELETE FROM public.menu_items WHERE restaurant_id = ANY(v_restaurant_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('menu_items', v_count);
  END IF;

  IF to_regclass('public.menu_categories') IS NOT NULL THEN
    DELETE FROM public.menu_categories WHERE restaurant_id = ANY(v_restaurant_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('menu_categories', v_count);
  END IF;

  IF to_regclass('public.restaurant_application_messages') IS NOT NULL THEN
    DELETE FROM public.restaurant_application_messages
    WHERE application_id = ANY(v_application_ids)
       OR sender_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('restaurant_application_messages', v_count);
  END IF;

  IF to_regclass('public.restaurant_application_transitions') IS NOT NULL THEN
    DELETE FROM public.restaurant_application_transitions
    WHERE application_id = ANY(v_application_ids)
       OR actor_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('restaurant_application_transitions', v_count);
  END IF;

  IF to_regclass('public.restaurant_memberships') IS NOT NULL THEN
    DELETE FROM public.restaurant_memberships
    WHERE restaurant_id = ANY(v_restaurant_ids)
       OR user_id = ANY(v_profile_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('restaurant_memberships', v_count);
  END IF;

  UPDATE public.restaurants
  SET source_application_id = NULL
  WHERE id = ANY(v_restaurant_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('restaurants_source_application_cleared', v_count);

  UPDATE public.restaurant_applications
  SET restaurant_id = NULL
  WHERE id = ANY(v_application_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('applications_restaurant_cleared', v_count);

  -- Critical order: delete orders before route quotes so ON DELETE SET NULL on
  -- orders.route_quote_id never tries to mutate immutable order snapshots.
  DELETE FROM public.orders WHERE id = ANY(v_order_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('orders', v_count);

  -- Commercial terms are order-referenced through orders.commercial_term_id.
  -- Delete them only after the test order is gone, otherwise PostgreSQL tries
  -- to SET NULL on an immutable order snapshot.
  IF to_regclass('public.restaurant_commercial_terms') IS NOT NULL THEN
    DELETE FROM public.restaurant_commercial_terms terms
    WHERE (
        terms.application_id = ANY(v_application_ids)
        OR terms.restaurant_id = ANY(v_restaurant_ids)
        OR terms.proposed_by = ANY(v_profile_ids)
        OR terms.approved_by = ANY(v_profile_ids)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.commercial_term_id = terms.id
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('restaurant_commercial_terms', v_count);
  END IF;

  IF to_regclass('public.delivery_route_quotes') IS NOT NULL THEN
    DELETE FROM public.delivery_route_quotes
    WHERE (restaurant_id = ANY(v_restaurant_ids) OR customer_id = ANY(v_profile_ids))
      AND NOT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.route_quote_id = delivery_route_quotes.id
      );
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_counts := v_counts || jsonb_build_object('delivery_route_quotes', v_count);
  END IF;

  DELETE FROM public.restaurant_applications WHERE id = ANY(v_application_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('restaurant_applications', v_count);

  DELETE FROM public.restaurants WHERE id = ANY(v_restaurant_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('restaurants', v_count);

  DELETE FROM public.profiles
  WHERE id = ANY(v_profile_ids)
    AND role <> 'super_admin';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('profiles', v_count);

  INSERT INTO kiyo_0058_cleanup_result (
    cleanup_status, restaurant_ids, application_ids, order_ids, profile_ids, deleted_counts
  ) VALUES (
    'LIVE_E2E_CLEANUP_COMPLETE_0058',
    v_restaurant_ids,
    v_application_ids,
    v_order_ids,
    v_profile_ids,
    v_counts
  );
END;
$$;

SELECT
  cleanup_status,
  restaurant_ids,
  application_ids,
  order_ids,
  profile_ids,
  deleted_counts,
  completed_at
FROM kiyo_0058_cleanup_result
ORDER BY completed_at DESC
LIMIT 1;

COMMIT;
