-- Serialize marketplace-rule edits and reject stale clients that originally
-- observed no active override. This prevents lost updates from multiple tabs.
CREATE OR REPLACE FUNCTION public.set_marketplace_rule_override(
  p_scope_type text,
  p_scope_id text,
  p_values jsonb,
  p_effective_at timestamptz DEFAULT now(),
  p_reason text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
)
RETURNS public.marketplace_rule_overrides
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.marketplace_rule_overrides%ROWTYPE;
  v_result public.marketplace_rule_overrides%ROWTYPE;
  v_next_version integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can change marketplace rules.' USING ERRCODE = '42501';
  END IF;
  IF p_scope_type NOT IN ('wilaya','restaurant')
     OR length(trim(COALESCE(p_scope_id,''))) = 0
     OR p_values IS NULL
     OR jsonb_typeof(p_values) <> 'object'
     OR p_values = '{}'::jsonb THEN
    RAISE EXCEPTION 'A valid rule scope and non-empty object value are required.' USING ERRCODE = '22023';
  END IF;
  IF length(trim(COALESCE(p_reason,''))) < 3 THEN
    RAISE EXCEPTION 'A clear reason is required.' USING ERRCODE = '22023';
  END IF;
  IF p_scope_type = 'restaurant'
     AND NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_scope_id::uuid) THEN
    RAISE EXCEPTION 'Restaurant rule scope does not exist.' USING ERRCODE = 'P0002';
  END IF;
  IF p_scope_type = 'wilaya'
     AND NOT EXISTS (SELECT 1 FROM public.wilayas WHERE id = p_scope_id::smallint) THEN
    RAISE EXCEPTION 'Wilaya rule scope does not exist.' USING ERRCODE = 'P0002';
  END IF;

  -- A row lock cannot protect a scope that has no row yet. The transaction-level
  -- advisory lock serializes both first creation and subsequent replacement.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope_type || ':' || p_scope_id, 0));

  SELECT * INTO v_current
  FROM public.marketplace_rule_overrides
  WHERE scope_type = p_scope_type AND scope_id = p_scope_id
    AND status IN ('scheduled','active')
  FOR UPDATE;

  IF (p_expected_version IS NULL AND v_current.id IS NOT NULL)
     OR (p_expected_version IS NOT NULL
         AND (v_current.id IS NULL OR v_current.version <> p_expected_version)) THEN
    RAISE EXCEPTION 'Rules changed in another session. Reload before saving.' USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(max(version), 0) + 1 INTO v_next_version
  FROM public.marketplace_rule_overrides
  WHERE scope_type = p_scope_type AND scope_id = p_scope_id;

  UPDATE public.marketplace_rule_overrides
  SET status = 'replaced',
      expires_at = CASE WHEN effective_at < now() THEN LEAST(COALESCE(expires_at, now()), now()) ELSE NULL END,
      updated_at = now()
  WHERE id = v_current.id;

  INSERT INTO public.marketplace_rule_overrides (
    scope_type, scope_id, version, status, values, effective_at, created_by, reason
  ) VALUES (
    p_scope_type, p_scope_id, v_next_version,
    CASE WHEN COALESCE(p_effective_at, now()) > now() THEN 'scheduled' ELSE 'active' END,
    p_values, COALESCE(p_effective_at, now()), auth.uid(), trim(p_reason)
  ) RETURNING * INTO v_result;

  PERFORM public.log_activity(
    'admin_action', 'marketplace_rule_override', v_result.id,
    jsonb_build_object(
      'action', 'rule_override_set', 'scope_type', p_scope_type, 'scope_id', p_scope_id,
      'previous_version', v_current.version, 'new_version', v_result.version,
      'previous_values', v_current.values, 'new_values', v_result.values,
      'effective_at', v_result.effective_at, 'reason', p_reason
    )
  );
  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_marketplace_rule_override(text, text, jsonb, timestamptz, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_marketplace_rule_override(text, text, jsonb, timestamptz, text, integer) TO authenticated;

