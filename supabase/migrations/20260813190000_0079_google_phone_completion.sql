-- Kiyo Food 0079: require a verified profile phone after Google OAuth.
-- Additive and data-safe: no tables or historical rows are deleted or rewritten.

CREATE OR REPLACE FUNCTION public.complete_google_profile_phone(p_phone text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_provider text;
  v_providers jsonb;
  v_phone text;
  v_profile public.profiles;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  SELECT
    raw_app_meta_data->>'provider',
    COALESCE(raw_app_meta_data->'providers', '[]'::jsonb)
  INTO v_provider, v_providers
  FROM auth.users
  WHERE id = v_user_id;

  IF v_provider IS DISTINCT FROM 'google'
     AND NOT (v_providers ? 'google') THEN
    RAISE EXCEPTION 'This action is only available after Google sign-in.' USING ERRCODE = '42501';
  END IF;

  v_phone := public.kiyo_normalize_algerian_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Enter a valid Algerian mobile number.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET phone = v_phone,
      updated_at = pg_catalog.now()
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'The signed-in profile does not exist.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    v_user_id,
    'profile_updated'::public.audit_action,
    'profile',
    v_user_id,
    jsonb_build_object('field', 'phone', 'source', 'google_oauth_completion')
  );

  RETURN v_profile;
END;
$$;

COMMENT ON FUNCTION public.complete_google_profile_phone(text)
IS 'Allows only the signed-in Google identity to save its own validated Algerian phone number after OAuth. Writes an immutable audit event.';

REVOKE EXECUTE ON FUNCTION public.complete_google_profile_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_google_profile_phone(text) TO authenticated;
