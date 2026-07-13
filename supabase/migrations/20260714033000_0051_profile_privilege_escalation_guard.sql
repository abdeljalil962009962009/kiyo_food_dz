-- Prevent browser clients from promoting or administratively modifying their
-- own profile. Public profile fields remain self-service; trusted domain
-- functions and Supabase Auth retain their existing server-side access.
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
BEGIN
  -- SQL migrations, Supabase Auth, and service-role domain functions are the
  -- only supported writers of privileged profile fields.
  IF current_user IN ('postgres', 'service_role', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid()
       OR NEW.role IS DISTINCT FROM 'customer'::public.user_role
       OR COALESCE(NEW.is_suspended, false)
       OR NEW.suspended_reason IS NOT NULL
       OR NEW.suspended_at IS NOT NULL
       OR COALESCE(NEW.failed_login_attempts, 0) <> 0
       OR NEW.locked_until IS NOT NULL
       OR NEW.deleted_at IS NOT NULL
       OR NEW.export_requested_at IS NOT NULL
       OR NEW.last_login_at IS NOT NULL
       OR NEW.last_login_ip IS NOT NULL THEN
      RAISE EXCEPTION 'Protected profile fields can only be set by the trusted server.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.failed_login_attempts IS DISTINCT FROM OLD.failed_login_attempts
     OR NEW.locked_until IS DISTINCT FROM OLD.locked_until
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.export_requested_at IS DISTINCT FROM OLD.export_requested_at
     OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
     OR NEW.last_login_ip IS DISTINCT FROM OLD.last_login_ip
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Protected profile fields can only be changed by the trusted server.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_fields ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_fields();

REVOKE ALL ON FUNCTION public.guard_profile_privileged_fields()
  FROM PUBLIC, anon, authenticated;

-- Consolidate legacy overlapping policies. Profile creation remains available
-- only as the safe customer fallback used when the Auth trigger is delayed.
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND role = 'customer'::public.user_role
    AND NOT COALESCE(is_suspended, false)
    AND COALESCE(failed_login_attempts, 0) = 0
    AND locked_until IS NULL
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_select_self_or_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (
    (id = auth.uid() AND deleted_at IS NULL)
    OR public.is_super_admin()
  );

COMMENT ON FUNCTION public.guard_profile_privileged_fields() IS
  'Blocks browser-controlled role, suspension, lockout, identity, and compliance-field changes.';

COMMIT;
