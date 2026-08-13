DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(proc.oid)
  INTO v_definition
  FROM pg_catalog.pg_proc AS proc
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'complete_google_profile_phone'
    AND pg_catalog.pg_get_function_identity_arguments(proc.oid) = 'p_phone text';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION '0079 failed: Google phone completion function is missing';
  END IF;

  IF position('raw_app_meta_data' IN v_definition) = 0
     OR position('kiyo_normalize_algerian_phone' IN v_definition) = 0
     OR position('WHERE id = v_user_id' IN v_definition) = 0 THEN
    RAISE EXCEPTION '0079 failed: provider, phone validation, or self-ownership guard is missing';
  END IF;

  IF pg_catalog.has_function_privilege('anon', 'public.complete_google_profile_phone(text)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated', 'public.complete_google_profile_phone(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0079 failed: RPC privileges are incorrect';
  END IF;

  RAISE NOTICE '0079 Google phone completion assertions passed';
END;
$$;
