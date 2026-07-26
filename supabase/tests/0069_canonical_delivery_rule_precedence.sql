-- Structural and privilege assertions for migration 0069.
DO $assertions$
DECLARE
  v_delivery_definition text;
  v_marketplace_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(procedure.oid)
  INTO v_delivery_definition
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'resolve_marketplace_delivery_rules'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) =
      'p_restaurant_id uuid';

  IF v_delivery_definition IS NULL
     OR v_delivery_definition !~ 'v_restaurant_override\.values.*max_delivery_km'
     OR v_delivery_definition !~ 'v_wilaya\.values.*max_delivery_km'
     OR v_delivery_definition !~ 'v_global.*default_max_delivery_km'
     OR v_delivery_definition ~ 'v_restaurant\.max_delivery_km'
     OR v_delivery_definition ~ 'v_restaurant\.min_order_amount' THEN
    RAISE EXCEPTION '0069 failed: canonical delivery hierarchy is missing';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(procedure.oid)
  INTO v_marketplace_definition
  FROM pg_catalog.pg_proc AS procedure
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'resolve_marketplace_rules'
    AND pg_catalog.pg_get_function_identity_arguments(procedure.oid) =
      'p_restaurant_id uuid';

  IF v_marketplace_definition IS NULL
     OR position(
       'public.resolve_marketplace_delivery_rules(p_restaurant_id)'
       IN v_marketplace_definition
     ) = 0 THEN
    RAISE EXCEPTION '0069 failed: financial resolver bypasses canonical delivery rules';
  END IF;

  IF pg_catalog.has_function_privilege(
       'anon',
       'public.resolve_marketplace_delivery_rules(uuid)',
       'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       'authenticated',
       'public.resolve_marketplace_delivery_rules(uuid)',
       'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       'anon',
       'public.get_restaurant_effective_delivery_rules(uuid,uuid)',
       'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       'authenticated',
       'public.get_restaurant_effective_delivery_rules(uuid,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION '0069 failed: browser roles can bypass trusted delivery-rule access';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
       'service_role',
       'public.resolve_marketplace_delivery_rules(uuid)',
       'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       'service_role',
       'public.get_restaurant_effective_delivery_rules(uuid,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION '0069 failed: trusted server cannot resolve delivery rules';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.marketplace_rule_overrides'::regclass
      AND trigger_row.tgname = 'trg_validate_marketplace_delivery_override'
      AND NOT trigger_row.tgisinternal
  ) THEN
    RAISE EXCEPTION '0069 failed: future delivery overrides are not validated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.platform_settings'::regclass
      AND constraint_row.conname = 'platform_settings_delivery_limits'
      AND constraint_row.convalidated
  ) THEN
    RAISE EXCEPTION '0069 failed: global delivery limits are not validated';
  END IF;
END
$assertions$;

SELECT '0069 canonical delivery rule assertions passed' AS result;
