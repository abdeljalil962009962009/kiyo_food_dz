DO $assertions$
DECLARE
  v_exposed_count integer;
BEGIN
  SELECT count(*) INTO v_exposed_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.proname = ANY(ARRAY[
      'create_order_with_items', 'get_location_insights',
      'get_restaurant_analytics_summary', 'get_restaurant_financials',
      'get_restaurant_publication_readiness', 'get_top_products',
      'mark_restaurant_application_messages_read', 'quote_delivery_order_by_route',
      'reply_to_ticket', 'request_account_deletion', 'request_personal_data_export',
      'send_restaurant_application_message', 'submit_restaurant_application',
      'transition_delivery_status', 'transition_order_status', 'update_driver_live_location'
    ])
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  IF v_exposed_count <> 0 THEN
    RAISE EXCEPTION '0049 failed: % domain SECURITY DEFINER functions remain browser-executable', v_exposed_count;
  END IF;
  IF NOT has_function_privilege(
    'service_role',
    'public.execute_user_action(uuid,uuid,text,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0049 failed: trusted server gateway is unavailable';
  END IF;
END
$assertions$;

SELECT '0049 closed domain RPC assertions passed' AS result;
