-- Emergency rollback for an application deployment that cannot reach the 0048
-- gateway. Restore only the grants that existed before 0049.
BEGIN;

DO $restore_browser_privileges$
DECLARE
  v_function record;
  v_names text[] := ARRAY[
    'create_order_with_items', 'get_location_insights',
    'get_restaurant_analytics_summary', 'get_restaurant_financials',
    'get_restaurant_publication_readiness', 'get_top_products',
    'mark_restaurant_application_messages_read', 'quote_delivery_order_by_route',
    'reply_to_ticket', 'request_account_deletion', 'request_personal_data_export',
    'send_restaurant_application_message', 'submit_restaurant_application',
    'transition_delivery_status', 'transition_order_status', 'update_driver_live_location'
  ];
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(v_names)
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_function.signature);
  END LOOP;
  GRANT EXECUTE ON FUNCTION public.get_location_insights(double precision, double precision) TO anon;
END
$restore_browser_privileges$;

COMMIT;
