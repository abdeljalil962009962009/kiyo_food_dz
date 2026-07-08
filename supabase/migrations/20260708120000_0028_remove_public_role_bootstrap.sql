-- ============================================================================
-- KIYO FOOD 0028 - Remove public role bootstrap and hardcoded owner promotion
-- ============================================================================
-- Public signup must never grant staff/admin roles from client metadata or a
-- hardcoded email. New auth users start as customers. Staff roles are granted
-- later through owner/admin workflows protected by RLS and audit logs.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone,
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    'customer'::public.user_role,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Preserve compatibility for older app/database code paths while removing the
-- hardcoded promotion side effect.
CREATE OR REPLACE FUNCTION public.promote_owner_on_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN;
END;
$$;

-- Disable any legacy first-owner auto-promotion config if the table exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'owner_init_config'
  ) THEN
    UPDATE public.owner_init_config
    SET owner_assigned = true,
        updated_at = now()
    WHERE id = 1;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.promote_owner_on_login() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_owner_on_login() TO authenticated;
