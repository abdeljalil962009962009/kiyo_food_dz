-- Structural security assertions for migration 0068.
DO $assertions$
DECLARE
  v_security_definer boolean;
  v_search_path text;
BEGIN
  SELECT procedure.prosecdef,
         array_to_string(procedure.proconfig, ',')
  INTO v_security_definer, v_search_path
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'update_restaurant_operational_state'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) =
      'p_actor_id uuid, p_restaurant_id uuid, p_operational_status text, p_vacation_mode boolean, p_expected_updated_at timestamp with time zone';

  IF NOT FOUND OR NOT v_security_definer OR v_search_path IS DISTINCT FROM 'search_path=""' THEN
    RAISE EXCEPTION '0068 failed: authoritative restaurant operations function is missing or not hardened';
  END IF;

  IF pg_catalog.has_function_privilege(
       'anon',
       'public.update_restaurant_operational_state(uuid,uuid,text,boolean,timestamptz)',
       'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       'authenticated',
       'public.update_restaurant_operational_state(uuid,uuid,text,boolean,timestamptz)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION '0068 failed: browser roles can execute restaurant operations directly';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'service_role',
    'public.update_restaurant_operational_state(uuid,uuid,text,boolean,timestamptz)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0068 failed: trusted server cannot execute restaurant operations';
  END IF;
END
$assertions$;

SELECT '0068 authoritative restaurant operations assertions passed' AS result;
