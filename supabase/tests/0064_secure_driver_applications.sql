DO $assertions$
BEGIN
  IF (SELECT public FROM storage.buckets WHERE id = 'driver-documents') IS DISTINCT FROM false THEN
    RAISE EXCEPTION '0064 failed: driver documents bucket is not private';
  END IF;
  IF has_function_privilege('anon', 'public.submit_driver_application(uuid,jsonb,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0064 failed: anonymous users can submit driver applications';
  END IF;
  IF has_function_privilege('authenticated', 'public.submit_driver_application(uuid,jsonb,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0064 failed: browser users can bypass the trusted submission gateway';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.submit_driver_application(uuid,jsonb,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0064 failed: trusted submission gateway cannot submit';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc function
    JOIN pg_namespace namespace ON namespace.oid = function.pronamespace
    WHERE namespace.nspname = 'public'
      AND function.proname = 'submit_driver_application'
      AND function.prosecdef
  ) THEN
    RAISE EXCEPTION '0064 failed: submission RPC unexpectedly elevates privileges';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('drivers', 'driver_documents')
      AND cmd = 'INSERT'
      AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION '0064 failed: browser users retain direct application table inserts';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.drivers'::regclass
      AND tgname = 'drivers_guard_self_updates'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '0064 failed: protected driver field guard is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.drivers'::regclass
      AND tgname = 'drivers_audit_application_submission'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '0064 failed: submission audit trigger is missing';
  END IF;
  IF has_function_privilege(
    'authenticated',
    'public.review_driver_application(uuid,uuid,text,text,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0064 failed: browser users can review driver applications';
  END IF;
  IF NOT has_function_privilege(
    'service_role',
    'public.review_driver_application(uuid,uuid,text,text,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0064 failed: trusted owner gateway cannot review driver applications';
  END IF;
  RAISE NOTICE '0064 secure driver application assertions passed';
END
$assertions$;
