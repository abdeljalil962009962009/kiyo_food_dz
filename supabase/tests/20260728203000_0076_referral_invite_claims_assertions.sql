DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'referral_code'
  ) THEN
    RAISE EXCEPTION '0076 failed: profiles.referral_code is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'acquisition_source'
  ) THEN
    RAISE EXCEPTION '0076 failed: profiles.acquisition_source is missing.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'referrals'
      AND constraint_name = 'referrals_code_key'
  ) THEN
    RAISE EXCEPTION '0076 failed: referrals.code is still single-use unique.';
  END IF;

  IF to_regprocedure('public.claim_referral_code(text)') IS NULL THEN
    RAISE EXCEPTION '0076 failed: claim_referral_code RPC is missing.';
  END IF;

  IF to_regprocedure('public.award_referral_rewards_for_order(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION '0076 failed: referral first-order reward function is missing.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referrals'
      AND cmd IN ('INSERT', 'ALL')
      AND 'authenticated' = ANY(roles)
  ) THEN
    RAISE EXCEPTION '0076 failed: authenticated users can still insert referral reward rows directly.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_award_referral_rewards_on_delivery'
      AND tgrelid = 'public.orders'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '0076 failed: delivery reward trigger is missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges
    WHERE specific_schema = 'public'
      AND routine_name = 'claim_referral_code'
      AND grantee = 'authenticated'
      AND privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION '0076 failed: authenticated users cannot claim invite codes.';
  END IF;
END $$;

SELECT '0076 referral invite claims assertions passed' AS result;
