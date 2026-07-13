DO $assertions$
BEGIN
  IF to_regclass('public.user_action_requests') IS NULL THEN
    RAISE EXCEPTION '0048 failed: user_action_requests is missing';
  END IF;
  IF has_table_privilege('anon', 'public.user_action_requests', 'SELECT')
     OR has_table_privilege('authenticated', 'public.user_action_requests', 'SELECT') THEN
    RAISE EXCEPTION '0048 failed: browser roles can read user action requests';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.execute_user_action(uuid,uuid,text,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0048 failed: authenticated can execute trusted wrapper';
  END IF;
  IF NOT has_function_privilege(
    'service_role',
    'public.execute_user_action(uuid,uuid,text,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0048 failed: service role cannot execute trusted wrapper';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.execute_location_insights(uuid,double precision,double precision)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0048 failed: authenticated can execute location wrapper';
  END IF;
  IF NOT has_function_privilege(
    'service_role',
    'public.execute_location_insights(uuid,double precision,double precision)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0048 failed: service role cannot execute location wrapper';
  END IF;
END
$assertions$;

SELECT '0048 trusted domain action assertions passed' AS result;
