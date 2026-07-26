DO $test$
DECLARE
  v_function regprocedure;
BEGIN
  v_function := to_regprocedure('public.manage_marketing_control(uuid,uuid,text,jsonb)');
  IF v_function IS NULL THEN
    RAISE EXCEPTION '0073 failed: marketing control function is missing';
  END IF;
  IF has_function_privilege('anon', v_function, 'EXECUTE')
     OR has_function_privilege('authenticated', v_function, 'EXECUTE')
     OR has_function_privilege('public', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION '0073 failed: browser roles can execute marketing controls';
  END IF;
  IF NOT has_function_privilege('service_role', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION '0073 failed: trusted server cannot execute marketing controls';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('promo_codes', 'marketing_campaigns', 'feature_flags', 'subscription_plans')
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND ('authenticated' = ANY(roles) OR 'anon' = ANY(roles) OR 'public' = ANY(roles))
  ) THEN
    RAISE EXCEPTION '0073 failed: browser marketing write policy remains';
  END IF;
END
$test$;

SELECT '0073 authoritative marketing control assertions passed' AS result;
