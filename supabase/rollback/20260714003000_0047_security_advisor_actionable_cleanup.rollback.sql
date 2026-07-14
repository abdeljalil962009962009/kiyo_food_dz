-- Emergency rollback for migration 0047. Apply only with an application
-- rollback and only after reviewing the reason for reverting least privilege.
BEGIN;

DO $view_security$
BEGIN
  IF to_regclass('public.driver_profile_view') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.driver_profile_view SET (security_invoker = false, security_barrier = false)';
  END IF;
END
$view_security$;

DROP POLICY IF EXISTS owner_action_requests_deny_browser ON public.owner_action_requests;

ALTER FUNCTION public.mark_notification_read(uuid) SECURITY DEFINER;
ALTER FUNCTION public.mark_all_notifications_read() SECURITY DEFINER;
ALTER FUNCTION public.get_user_restaurant_id() SECURITY DEFINER;

DO $restore_privileges$
DECLARE
  v_function record;
  v_names text[] := ARRAY[
    'calculate_delivery_fee', 'calculate_marketplace_order_financials',
    'calculate_order_financials', 'compute_restaurant_discovery_score',
    'get_delivery_distance', 'get_restaurants_with_discovery',
    'owner_control_center_health', 'quote_delivery_order',
    'resolve_marketplace_rules', 'rls_auto_enable',
    'search_restaurants_and_menu', 'user_can_access_restaurant',
    'validate_promo_code'
  ];
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(v_names)
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_function.signature);
  END LOOP;
END
$restore_privileges$;

COMMIT;
