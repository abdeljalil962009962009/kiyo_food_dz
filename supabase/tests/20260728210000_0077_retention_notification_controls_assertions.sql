DO $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT value
  INTO v_value
  FROM public.platform_settings
  WHERE key = 'retention';

  IF v_value IS NULL THEN
    RAISE EXCEPTION '0077 failed: retention platform setting is missing.';
  END IF;

  IF COALESCE((v_value->>'abandoned_cart_minutes')::integer, 0) < 1 THEN
    RAISE EXCEPTION '0077 failed: abandoned cart reminder window is invalid.';
  END IF;

  IF COALESCE((v_value->>'winback_days')::integer, 0) < 1 THEN
    RAISE EXCEPTION '0077 failed: win-back window is invalid.';
  END IF;
END $$;

SELECT '0077 retention notification controls assertions passed' AS result;
