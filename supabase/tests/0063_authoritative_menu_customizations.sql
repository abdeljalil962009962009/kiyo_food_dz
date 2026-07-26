DO $assertions$
DECLARE
  v_function_source text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'menu_item_modifiers'
      AND column_name = 'is_active'
  ) THEN
    RAISE EXCEPTION '0063 failed: modifier active state is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'modifier_options'
      AND column_name = 'is_available'
  ) THEN
    RAISE EXCEPTION '0063 failed: option availability state is missing';
  END IF;

  SELECT pg_get_functiondef(
    'public.calculate_marketplace_order_financials(uuid,jsonb,integer)'::regprocedure
  ) INTO v_function_source;
  IF v_function_source NOT LIKE '%selected_option_ids%'
     OR v_function_source NOT LIKE '%price_adjustion%'
     OR v_function_source NOT LIKE '%modifier_total%'
     OR v_function_source NOT LIKE '%does not belong to this dish%' THEN
    RAISE EXCEPTION '0063 failed: financial validation is incomplete';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.calculate_marketplace_order_financials(uuid,jsonb,integer)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.calculate_marketplace_order_financials(uuid,jsonb,integer)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0063 failed: browser roles can execute authoritative finance directly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.order_items'::regclass
      AND tgname = 'order_items_snapshot_modifiers'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '0063 failed: immutable option snapshot trigger is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'menu_item_modifiers'
      AND policyname = 'modifiers_select'
      AND roles @> ARRAY['anon'::name]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'modifier_options'
      AND policyname = 'options_select'
      AND roles @> ARRAY['anon'::name]
  ) THEN
    RAISE EXCEPTION '0063 failed: public published-menu option policies are missing';
  END IF;

  RAISE NOTICE '0063 authoritative menu customization assertions passed';
END
$assertions$;
