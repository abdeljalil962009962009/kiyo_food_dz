-- Structural assertions for migration 0062.
DO $$
DECLARE
  v_security_definer boolean;
  v_search_path text;
BEGIN
  SELECT procedure.prosecdef,
         array_to_string(procedure.proconfig, ',')
  INTO v_security_definer, v_search_path
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'restaurant_accepts_orders'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) = 'p_restaurant_id uuid, p_at timestamp with time zone';

  IF NOT FOUND OR NOT v_security_definer OR v_search_path IS DISTINCT FROM 'search_path=""' THEN
    RAISE EXCEPTION '0062 failed: restaurant_accepts_orders is missing or not hardened';
  END IF;

  IF pg_catalog.has_function_privilege('anon', 'public.restaurant_accepts_orders(uuid,timestamptz)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.restaurant_accepts_orders(uuid,timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION '0062 failed: browser roles can execute authoritative availability directly';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_special_hours'
      AND policyname = 'special_hours_public_select'
      AND 'anon' = ANY(roles)
      AND 'authenticated' = ANY(roles)
  ) THEN
    RAISE EXCEPTION '0062 failed: public exceptional-hours read policy is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger
    JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger.tgrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'orders'
      AND trigger.tgname = 'trg_order_restaurant_available'
      AND NOT trigger.tgisinternal
  ) THEN
    RAISE EXCEPTION '0062 failed: authoritative order availability trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger
    JOIN pg_catalog.pg_class AS relation ON relation.oid = trigger.tgrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'delivery_route_quotes'
      AND trigger.tgname = 'trg_route_quote_restaurant_available'
      AND NOT trigger.tgisinternal
  ) THEN
    RAISE EXCEPTION '0062 failed: authoritative quote availability trigger is missing';
  END IF;
END;
$$;

SELECT '0062 authoritative restaurant availability assertions passed' AS result;
