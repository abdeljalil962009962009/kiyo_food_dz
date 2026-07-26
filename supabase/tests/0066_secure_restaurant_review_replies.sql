DO $assertions$
BEGIN
  IF has_function_privilege(
    'anon',
    'public.reply_to_restaurant_review(uuid,uuid,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.reply_to_restaurant_review(uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0066 failed: browser roles can write restaurant replies directly';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.reply_to_restaurant_review(uuid,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0066 failed: trusted user gateway cannot write restaurant replies';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc function
    JOIN pg_namespace namespace ON namespace.oid = function.pronamespace
    WHERE namespace.nspname = 'public'
      AND function.proname = 'reply_to_restaurant_review'
      AND function.prosecdef
  ) THEN
    RAISE EXCEPTION '0066 failed: restaurant reply function unexpectedly elevates privileges';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reviews'
      AND cmd = 'UPDATE'
      AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION '0066 failed: browser review updates remain enabled';
  END IF;

  RAISE NOTICE '0066 secure restaurant review reply assertions passed';
END
$assertions$;
