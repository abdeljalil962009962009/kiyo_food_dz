DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'marketing_campaigns'
      AND policyname = 'campaigns_select_public_homepage'
      AND roles::text LIKE '%anon%'
  ) THEN
    RAISE EXCEPTION '0075 failed: public homepage campaign policy is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'marketing_campaigns'
      AND indexname = 'idx_marketing_campaigns_public_homepage'
  ) THEN
    RAISE EXCEPTION '0075 failed: public homepage campaign index is missing.';
  END IF;
END $$;

SELECT '0075 public homepage campaign policy assertions passed' AS result;
