DO $assertions$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.submit_order_review(uuid,uuid,integer,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.submit_order_review(uuid,uuid,integer,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0065 failed: browser roles can bypass the trusted review gateway';
  END IF;
  IF NOT has_function_privilege(
    'service_role',
    'public.submit_order_review(uuid,uuid,integer,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0065 failed: trusted gateway cannot submit reviews';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc function
    JOIN pg_namespace namespace ON namespace.oid = function.pronamespace
    WHERE namespace.nspname = 'public'
      AND function.proname = 'submit_order_review'
      AND function.prosecdef
  ) THEN
    RAISE EXCEPTION '0065 failed: review submission unexpectedly elevates privileges';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reviews'
      AND cmd IN ('INSERT', 'UPDATE')
      AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION '0065 failed: direct browser review writes remain enabled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.reviews'::regclass
      AND tgname = 'trg_update_restaurant_rating'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '0065 failed: restaurant rating refresh trigger is missing';
  END IF;
  RAISE NOTICE '0065 authoritative order review assertions passed';
END
$assertions$;
