-- Compatibility repair for legacy internal audit calls.
-- Safe/additive: creates one locked-down overload, no data deletion or table rewrites.

CREATE OR REPLACE FUNCTION public.log_activity(
  action text,
  entity_type text,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.log_activity(
    action::public.audit_action,
    entity_type,
    entity_id,
    COALESCE(details, '{}'::jsonb)
  );
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'invalid_audit_action: %', action USING ERRCODE = '22023';
END;
$$;

COMMENT ON FUNCTION public.log_activity(text, text, uuid, jsonb)
IS 'Locked-down compatibility overload for internal SECURITY DEFINER functions that still pass audit actions as text. Browser roles cannot execute it directly.';

REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, jsonb) TO service_role;
