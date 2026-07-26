-- Structural security assertions for migration 0070.
DO $assertions$
DECLARE
  v_definition text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.restaurants'::regclass
      AND trigger_row.tgname = 'trg_guard_direct_restaurant_updates'
      AND NOT trigger_row.tgisinternal
  ) THEN
    RAISE EXCEPTION '0070 failed: direct browser restaurant updates are not guarded';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(procedure.oid)
  INTO v_definition
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'update_restaurant_profile_settings'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) =
      'p_actor_id uuid, p_restaurant_id uuid, p_payload jsonb, p_expected_updated_at timestamp with time zone';

  IF v_definition IS NULL
     OR v_definition !~ 'FOR UPDATE'
     OR v_definition !~ '40001'
     OR v_definition !~ 'Published restaurant location changes require platform review'
     OR v_definition !~ 'kiyo_is_coordinate_in_algeria' THEN
    RAISE EXCEPTION '0070 failed: secure restaurant settings invariants are incomplete';
  END IF;

  IF pg_catalog.has_function_privilege(
       'anon',
       'public.update_restaurant_profile_settings(uuid,uuid,jsonb,timestamptz)',
       'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       'authenticated',
       'public.update_restaurant_profile_settings(uuid,uuid,jsonb,timestamptz)',
       'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       'service_role',
       'public.update_restaurant_profile_settings(uuid,uuid,jsonb,timestamptz)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION '0070 failed: restaurant settings privileges are unsafe';
  END IF;
END
$assertions$;

SELECT '0070 secure restaurant profile settings assertions passed' AS result;
