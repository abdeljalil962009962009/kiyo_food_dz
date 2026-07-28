DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurants'
      AND column_name = 'is_exclusive_to_kiyo'
  ) THEN
    RAISE EXCEPTION '0074 failed: restaurants.is_exclusive_to_kiyo is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurants'
      AND column_name = 'fair_commission_message'
  ) THEN
    RAISE EXCEPTION '0074 failed: restaurants.fair_commission_message is missing';
  END IF;

  IF to_regprocedure('public.update_restaurant_admin(uuid,text,boolean,boolean,boolean,text)') IS NULL THEN
    RAISE EXCEPTION '0074 failed: updated restaurant admin RPC signature is missing';
  END IF;

  IF to_regprocedure('public.execute_owner_action(uuid,uuid,text,jsonb)') IS NULL THEN
    RAISE EXCEPTION '0074 failed: trusted owner action gateway is missing';
  END IF;
END;
$$;

SELECT '0074 exclusive restaurant growth controls assertions passed' AS result;
