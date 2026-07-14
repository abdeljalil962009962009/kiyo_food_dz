-- Read-only structural and data-integrity acceptance checks for the integrated
-- marketplace domain. Run only after staging migrations 0037-0049 succeed.
-- This script does not create, update, or delete business data.

DO $acceptance$
DECLARE
  v_missing integer;
  v_count integer;
  v_names text[];
BEGIN
  v_names := ARRAY[
    'restaurant_applications', 'restaurant_application_transitions',
    'restaurant_application_messages', 'restaurant_memberships',
    'restaurant_commercial_terms', 'marketplace_rule_overrides',
    'delivery_route_quotes', 'order_status_transitions',
    'owner_action_requests', 'user_action_requests'
  ];

  SELECT count(*) INTO v_missing
  FROM unnest(v_names) AS required(table_name)
  WHERE to_regclass('public.' || required.table_name) IS NULL;
  IF v_missing <> 0 THEN
    RAISE EXCEPTION '0050 failed: % required marketplace tables are missing', v_missing;
  END IF;

  SELECT count(*) INTO v_missing
  FROM pg_class relation
  JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY(v_names)
    AND relation.relkind = 'r'
    AND NOT relation.relrowsecurity;
  IF v_missing <> 0 THEN
    RAISE EXCEPTION '0050 failed: % sensitive marketplace tables do not have RLS enabled', v_missing;
  END IF;

  v_names := ARRAY[
    'idx_restaurant_applications_one_active_per_applicant',
    'idx_restaurant_applications_submission_key',
    'idx_restaurant_applications_restaurant',
    'idx_restaurants_source_application',
    'idx_commercial_terms_one_active',
    'idx_marketplace_rule_override_current',
    'idx_orders_idempotency'
  ];
  SELECT count(*) INTO v_missing
  FROM unnest(v_names) AS required(index_name)
  WHERE to_regclass('public.' || required.index_name) IS NULL;
  IF v_missing <> 0 THEN
    RAISE EXCEPTION '0050 failed: % idempotency/versioning indexes are missing', v_missing;
  END IF;

  v_names := ARRAY[
    'submit_restaurant_application', 'review_restaurant_application',
    'preliminarily_approve_restaurant_application', 'publish_restaurant',
    'get_restaurant_publication_readiness', 'resolve_marketplace_rules',
    'record_trusted_delivery_route', 'quote_delivery_order_by_route',
    'create_order_with_items', 'transition_order_status',
    'transition_delivery_status', 'execute_owner_action', 'execute_user_action'
  ];
  SELECT count(*) INTO v_missing
  FROM unnest(v_names) AS required(function_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE namespace.nspname = 'public' AND routine.proname = required.function_name
  );
  IF v_missing <> 0 THEN
    RAISE EXCEPTION '0050 failed: % canonical domain functions are missing', v_missing;
  END IF;

  v_names := ARRAY[
    'trg_guard_restaurant_lifecycle_status',
    'trg_guard_order_domain_updates',
    'trg_guard_locked_ledger'
  ];
  SELECT count(*) INTO v_missing
  FROM unnest(v_names) AS required(trigger_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_trigger trigger_row
    WHERE trigger_row.tgname = required.trigger_name AND NOT trigger_row.tgisinternal
  );
  IF v_missing <> 0 THEN
    RAISE EXCEPTION '0050 failed: % lifecycle/financial guard triggers are missing', v_missing;
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc routine
  JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
  WHERE namespace.nspname = 'public'
    AND routine.proname = ANY(ARRAY[
      'create_order_with_items', 'get_restaurant_analytics_summary',
      'get_restaurant_financials', 'get_restaurant_publication_readiness',
      'get_top_products', 'mark_restaurant_application_messages_read',
      'quote_delivery_order_by_route', 'reply_to_ticket',
      'request_account_deletion', 'request_personal_data_export',
      'send_restaurant_application_message', 'submit_restaurant_application',
      'transition_delivery_status', 'transition_order_status',
      'update_driver_live_location'
    ])
    AND (
      has_function_privilege('anon', routine.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', routine.oid, 'EXECUTE')
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION '0050 failed: % trusted-domain functions remain directly browser executable', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc routine
  JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
  WHERE namespace.nspname = 'public'
    AND routine.proname = ANY(ARRAY[
      'generate_monthly_settlement', 'mark_settlement_paid', 'set_user_suspended', 'update_platform_setting',
      'review_restaurant_application', 'preliminarily_approve_restaurant_application',
      'publish_restaurant', 'set_restaurant_status',
      'set_marketplace_rule_override', 'remove_marketplace_rule_override'
    ])
    AND (
      has_function_privilege('anon', routine.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', routine.oid, 'EXECUTE')
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION '0050 failed: % owner functions remain directly browser executable', v_count;
  END IF;

  IF has_function_privilege('anon', 'public.execute_owner_action(uuid,uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.execute_owner_action(uuid,uuid,text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.execute_owner_action(uuid,uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION '0050 failed: owner gateway privilege boundary is incorrect';
  END IF;
  IF has_function_privilege('anon', 'public.execute_user_action(uuid,uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.execute_user_action(uuid,uuid,text,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.execute_user_action(uuid,uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION '0050 failed: user gateway privilege boundary is incorrect';
  END IF;

  IF has_table_privilege('anon', 'public.owner_action_requests', 'SELECT')
     OR has_table_privilege('authenticated', 'public.owner_action_requests', 'SELECT')
     OR has_table_privilege('anon', 'public.user_action_requests', 'SELECT')
     OR has_table_privilege('authenticated', 'public.user_action_requests', 'SELECT') THEN
    RAISE EXCEPTION '0050 failed: browser roles can inspect trusted action request records';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_policies policy
  WHERE policy.schemaname = 'public'
    AND policy.tablename = ANY(ARRAY[
      'restaurant_applications', 'restaurant_application_transitions',
      'restaurant_application_messages', 'restaurant_memberships',
      'restaurant_commercial_terms', 'marketplace_rule_overrides',
      'delivery_route_quotes', 'orders', 'order_items', 'financial_ledger',
      'settlements', 'owner_action_requests', 'user_action_requests'
    ])
    AND policy.cmd IN ('ALL', 'SELECT', 'UPDATE', 'DELETE')
    AND lower(COALESCE(policy.qual, '')) IN ('true', '(true)');
  IF v_count <> 0 THEN
    RAISE EXCEPTION '0050 failed: % sensitive read/write policies are unconditionally true', v_count;
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.can_manage_restaurant(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_super_admin()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.restaurant_is_visible(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0050 failed: required read-only RLS helpers are unavailable';
  END IF;
  IF has_function_privilege('anon', 'public.can_manage_restaurant(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.is_super_admin()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.restaurant_is_visible(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0050 failed: authorization helpers are exposed anonymously';
  END IF;

  SELECT count(*) INTO v_missing
  FROM unnest(ARRAY[
    'payment_method', 'route_quote_id', 'route_provider',
    'route_distance_meters', 'route_duration_seconds', 'commercial_term_id',
    'financial_snapshot', 'financial_calculated_at'
  ]) AS required(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns column_row
    WHERE column_row.table_schema = 'public'
      AND column_row.table_name = 'orders'
      AND column_row.column_name = required.column_name
  );
  IF v_missing <> 0 THEN
    RAISE EXCEPTION '0050 failed: % immutable order snapshot columns are missing', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.restaurant_applications application
    WHERE application.status NOT IN ('rejected', 'published', 'archived')
    GROUP BY application.applicant_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0050 failed: an applicant has duplicate active applications';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.restaurant_memberships membership
    GROUP BY membership.restaurant_id, membership.user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0050 failed: duplicate restaurant memberships exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.restaurant_commercial_terms terms
    WHERE terms.status = 'active'
    GROUP BY terms.restaurant_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0050 failed: a restaurant has multiple active commercial agreements';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orders order_row
    WHERE order_row.financial_calculated_at IS NOT NULL
      AND (
        order_row.payment_method <> 'cash_on_delivery'
        OR order_row.route_quote_id IS NULL
        OR order_row.route_distance_meters IS NULL
        OR order_row.route_duration_seconds IS NULL
        OR order_row.commercial_term_id IS NULL
        OR order_row.financial_snapshot IS NULL
      )
  ) THEN
    RAISE EXCEPTION '0050 failed: a new COD order has an incomplete immutable financial/route snapshot';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.restaurants restaurant
    WHERE restaurant.source_application_id IS NOT NULL
      AND restaurant.status = 'published'
      AND (
        NOT COALESCE(restaurant.location_verified, false)
        OR restaurant.latitude IS NULL OR restaurant.longitude IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM public.restaurant_memberships membership
          WHERE membership.restaurant_id = restaurant.id
            AND membership.membership_role = 'owner' AND membership.status = 'active'
        )
        OR NOT EXISTS (
          SELECT 1 FROM public.restaurant_commercial_terms terms
          WHERE terms.restaurant_id = restaurant.id AND terms.status = 'active'
            AND terms.effective_at <= now()
            AND (terms.expires_at IS NULL OR terms.expires_at > now())
        )
      )
  ) THEN
    RAISE EXCEPTION '0050 failed: an application-backed published restaurant violates readiness invariants';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets bucket
    WHERE bucket.id = 'restaurant-applications' AND bucket.public = false
  ) THEN
    RAISE EXCEPTION '0050 failed: restaurant application media bucket is not private';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables published
    WHERE published.pubname = 'supabase_realtime'
      AND published.schemaname = 'public'
      AND published.tablename = 'restaurant_applications'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_publication_tables published
    WHERE published.pubname = 'supabase_realtime'
      AND published.schemaname = 'public'
      AND published.tablename = 'restaurant_application_messages'
  ) THEN
    RAISE EXCEPTION '0050 failed: application queue/conversation realtime publication is incomplete';
  END IF;
END
$acceptance$;

SELECT '0050 marketplace acceptance assertions passed' AS result;
