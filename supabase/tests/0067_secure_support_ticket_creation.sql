DO $assertions$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tickets'
      AND column_name = 'client_request_id'
  ) THEN
    RAISE EXCEPTION '0067 failed: support ticket request identifier is missing';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.create_support_ticket(uuid,uuid,text,text,text,text,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.create_support_ticket(uuid,uuid,text,text,text,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0067 failed: browser roles can execute secure ticket creation';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.create_support_ticket(uuid,uuid,text,text,text,text,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0067 failed: service role cannot execute secure ticket creation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'support_tickets'
      AND cmd IN ('INSERT', 'ALL')
      AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles))
  ) THEN
    RAISE EXCEPTION '0067 failed: browser roles retain direct support ticket insertion';
  END IF;
END
$assertions$;

SELECT '0067 secure support ticket assertions passed' AS result;
