-- Run after migration 0046 in staging. Any regression raises an exception.
DO $test$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND EXISTS (
      SELECT 1
      FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
      WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
    )
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Security regression: % application functions are executable by PUBLIC.', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'log_activity', 'generate_monthly_settlement', 'mark_settlement_paid', 'set_user_suspended',
      'update_platform_setting', 'publish_restaurant',
      'preliminarily_approve_restaurant_application',
      'set_marketplace_rule_override', 'remove_marketplace_rule_override'
    )
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Security regression: % privileged functions remain directly executable by authenticated.', v_count;
  END IF;

  IF has_function_privilege('authenticated', 'public.execute_owner_action(uuid,uuid,text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.execute_owner_action(uuid,uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Security regression: owner gateway is browser executable.';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.execute_owner_action(uuid,uuid,text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Security regression: trusted backend cannot execute owner gateway.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'restaurant-applications' AND public
  ) THEN
    RAISE EXCEPTION 'Security regression: restaurant application bucket is public.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'search_logs'
      AND policyname = 'search_logs_insert'
      AND with_check NOT IN ('true', '(true)')
  ) THEN
    RAISE EXCEPTION 'Security regression: search_logs insert policy is missing or unrestricted.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
      AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) setting
        WHERE setting LIKE 'search_path=%'
      )
  ) THEN
    RAISE EXCEPTION 'Security regression: an application SECURITY DEFINER function has a mutable search_path.';
  END IF;
END
$test$;

SELECT '0046 security assertions passed' AS result;
