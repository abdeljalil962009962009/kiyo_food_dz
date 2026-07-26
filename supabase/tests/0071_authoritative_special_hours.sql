-- Structural assertions for migration 0071.
DO $assertions$
DECLARE
  v_definition text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_special_hours'
      AND policyname = 'special_hours_modify'
  ) THEN
    RAISE EXCEPTION '0071 failed: direct browser schedule writes remain enabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_special_hours'
      AND policyname = 'special_hours_manager_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION '0071 failed: owners cannot read unpublished exceptional hours';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(procedure.oid)
  INTO v_definition
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'upsert_restaurant_special_hours'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) =
      'p_actor_id uuid, p_restaurant_id uuid, p_date date, p_is_closed boolean, p_open_time time without time zone, p_close_time time without time zone, p_reason text, p_expected_updated_at timestamp with time zone';

  IF v_definition IS NULL
     OR v_definition !~ 'FOR UPDATE'
     OR v_definition !~ '40001'
     OR v_definition !~ 'Africa/Algiers'
     OR v_definition !~ 'audit_logs' THEN
    RAISE EXCEPTION '0071 failed: authoritative exceptional-hours invariants are incomplete';
  END IF;

  IF pg_catalog.has_function_privilege(
       'authenticated',
       'public.upsert_restaurant_special_hours(uuid,uuid,date,boolean,time,time,text,timestamptz)',
       'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       'service_role',
       'public.upsert_restaurant_special_hours(uuid,uuid,date,boolean,time,time,text,timestamptz)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION '0071 failed: exceptional-hours function privileges are unsafe';
  END IF;
END
$assertions$;

SELECT '0071 authoritative special hours assertions passed' AS result;
