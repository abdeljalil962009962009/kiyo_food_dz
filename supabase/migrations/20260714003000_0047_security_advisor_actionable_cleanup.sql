-- Resolve the actionable application-owned findings remaining after 0046.
-- PostGIS, spatial_ref_sys and extension-owned st_* functions are excluded.
BEGIN;

-- The legacy driver view previously ran with its owner's privileges and could
-- bypass the RLS policies on drivers/profiles. Force invoker semantics so the
-- current driver's/admin's underlying table policies always apply.
DO $view_security$
BEGIN
  IF to_regclass('public.driver_profile_view') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.driver_profile_view SET (security_invoker = true, security_barrier = true)';
  END IF;
END
$view_security$;

-- This table is service-role-only. A deny policy documents that contract and
-- avoids an ambiguous "RLS enabled without policies" state for future audits.
DROP POLICY IF EXISTS owner_action_requests_deny_browser ON public.owner_action_requests;
CREATE POLICY owner_action_requests_deny_browser
  ON public.owner_action_requests
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- These helpers only update rows already protected by ownership RLS and do not
-- need elevated privileges. Invoker mode removes unnecessary privilege bypass.
ALTER FUNCTION public.mark_notification_read(uuid) SECURITY INVOKER;
ALTER FUNCTION public.mark_all_notifications_read() SECURITY INVOKER;
ALTER FUNCTION public.get_user_restaurant_id() SECURITY INVOKER;

-- These routines are internal calculation/maintenance primitives, superseded
-- discovery RPCs, or server/admin diagnostics. Browser callers do not use them;
-- canonical SECURITY DEFINER domain services call them as the function owner.
DO $internal_privileges$
DECLARE
  v_function record;
  v_internal_names text[] := ARRAY[
    'calculate_delivery_fee',
    'calculate_marketplace_order_financials',
    'calculate_order_financials',
    'compute_restaurant_discovery_score',
    'get_delivery_distance',
    'get_restaurants_with_discovery',
    'owner_control_center_health',
    'quote_delivery_order',
    'resolve_marketplace_rules',
    'rls_auto_enable',
    'search_restaurants_and_menu',
    'user_can_access_restaurant',
    'validate_promo_code'
  ];
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(v_internal_names)
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function.signature
    );
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function.signature);
  END LOOP;
END
$internal_privileges$;

COMMIT;
