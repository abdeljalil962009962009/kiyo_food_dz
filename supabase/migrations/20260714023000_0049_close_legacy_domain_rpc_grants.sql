-- The compatible server gateway from 0048 is verified in staging and all
-- browser callers now use it. Close direct execution of application-owned
-- SECURITY DEFINER domain RPCs while preserving their canonical logic.
BEGIN;

DO $browser_domain_privileges$
DECLARE
  v_function record;
  v_names text[] := ARRAY[
    'create_order_with_items',
    'get_location_insights',
    'get_restaurant_analytics_summary',
    'get_restaurant_financials',
    'get_restaurant_publication_readiness',
    'get_top_products',
    'mark_restaurant_application_messages_read',
    'quote_delivery_order_by_route',
    'reply_to_ticket',
    'request_account_deletion',
    'request_personal_data_export',
    'send_restaurant_application_message',
    'submit_restaurant_application',
    'transition_delivery_status',
    'transition_order_status',
    'update_driver_live_location'
  ];
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(v_names)
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
$browser_domain_privileges$;

COMMIT;
