DO $$
BEGIN
  IF to_regprocedure('public.log_activity(text,text,uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION '0060 failed: text compatibility audit logger is missing';
  END IF;

  IF has_function_privilege('anon', 'public.log_activity(text,text,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION '0060 failed: anon can execute text compatibility audit logger';
  END IF;

  IF has_function_privilege('authenticated', 'public.log_activity(text,text,uuid,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION '0060 failed: authenticated can execute text compatibility audit logger';
  END IF;
END $$;

SELECT '0060 audit log compatibility assertions passed' AS result;
