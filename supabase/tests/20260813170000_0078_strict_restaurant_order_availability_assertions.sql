DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(proc.oid)
  INTO v_definition
  FROM pg_catalog.pg_proc AS proc
  JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'restaurant_accepts_orders'
    AND pg_catalog.pg_get_function_identity_arguments(proc.oid) = 'p_restaurant_id uuid, p_at timestamp with time zone';

  IF v_definition IS NULL THEN
    RAISE EXCEPTION '0078 failed: restaurant_accepts_orders is missing';
  END IF;

  IF position('operational_status <> ''open''' IN v_definition) = 0 THEN
    RAISE EXCEPTION '0078 failed: busy/closed restaurants are not rejected authoritatively';
  END IF;

  IF pg_catalog.has_function_privilege('anon', 'public.restaurant_accepts_orders(uuid,timestamptz)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.restaurant_accepts_orders(uuid,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION '0078 failed: internal availability function is browser-executable';
  END IF;

  RAISE NOTICE '0078 strict restaurant order availability assertions passed';
END;
$$;
