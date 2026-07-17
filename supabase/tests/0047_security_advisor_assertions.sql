-- Run after migration 0047 in staging. Any actionable regression raises.
DO $test$
DECLARE
  v_count integer;
BEGIN
  IF to_regclass('public.driver_profile_view') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'driver_profile_view'
         AND COALESCE(c.reloptions, ARRAY[]::text[]) @> ARRAY['security_invoker=true']
     ) THEN
    RAISE EXCEPTION 'Security regression: driver_profile_view is not SECURITY INVOKER.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'owner_action_requests'
      AND policyname = 'owner_action_requests_deny_browser'
  ) THEN
    RAISE EXCEPTION 'Security regression: owner action request deny policy is missing.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'mark_notification_read', 'mark_all_notifications_read',
        'get_user_restaurant_id'
      )
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'Security regression: an ownership-RLS helper still bypasses caller permissions.';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'calculate_delivery_fee', 'calculate_marketplace_order_financials',
      'calculate_order_financials', 'compute_restaurant_discovery_score',
      'get_delivery_distance', 'get_restaurants_with_discovery',
      'owner_control_center_health', 'quote_delivery_order',
      'resolve_marketplace_rules', 'rls_auto_enable',
      'search_restaurants_and_menu', 'user_can_access_restaurant',
      'validate_promo_code'
    )
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Security regression: % internal functions remain browser executable.', v_count;
  END IF;

  -- Only one deliberately anonymous application SECURITY DEFINER function is
  -- permitted: a bounded aggregate-only location insight RPC. Extension-owned
  -- functions such as PostGIS st_estimatedextent are explicitly excluded.
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname <> 'get_location_insights'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.deptype = 'e'
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Security regression: % unexpected anonymous SECURITY DEFINER functions remain.', v_count;
  END IF;
END
$test$;

SELECT '0047 security advisor assertions passed' AS result;
