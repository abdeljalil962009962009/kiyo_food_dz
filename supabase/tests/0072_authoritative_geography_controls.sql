DO $test$
DECLARE
  v_function regprocedure;
BEGIN
  v_function := to_regprocedure('public.manage_geography_control(uuid,uuid,text,jsonb)');
  IF v_function IS NULL THEN
    RAISE EXCEPTION '0072 failed: geography control function is missing';
  END IF;

  IF has_function_privilege('anon', v_function, 'EXECUTE')
     OR has_function_privilege('authenticated', v_function, 'EXECUTE')
     OR has_function_privilege('public', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION '0072 failed: browser roles can execute geography controls';
  END IF;
  IF NOT has_function_privilege('service_role', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION '0072 failed: trusted server cannot execute geography controls';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('delivery_zones', 'wilayas')
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND ('authenticated' = ANY(roles) OR 'anon' = ANY(roles) OR 'public' = ANY(roles))
  ) THEN
    RAISE EXCEPTION '0072 failed: browser geography write policy remains';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'delivery_zones'
      AND column_name = 'updated_by'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'wilayas'
      AND column_name = 'updated_by'
  ) THEN
    RAISE EXCEPTION '0072 failed: geography audit columns are missing';
  END IF;
END
$test$;

SELECT '0072 authoritative geography control assertions passed' AS result;
