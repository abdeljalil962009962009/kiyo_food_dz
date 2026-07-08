-- KIYO FOOD 0029 - Auth role repair and owner access hardening
-- Fixes a production bug where the client profile bootstrap could overwrite
-- an existing super_admin/restaurant_owner profile role back to customer.

DO $$
DECLARE
  v_owner_email text := 'sameraldjaber@gmail.com';
  v_owner_id uuid;
BEGIN
  SELECT id
    INTO v_owner_id
  FROM public.profiles
  WHERE lower(email) = lower(v_owner_email)
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'super_admin',
        locked_until = NULL,
        is_suspended = false,
        suspended_reason = NULL,
        suspended_at = NULL,
        updated_at = now()
    WHERE id = v_owner_id;

    IF to_regclass('public.admin_configuration') IS NOT NULL THEN
      INSERT INTO public.admin_configuration (user_id, granted_by, reason, is_active)
      VALUES (
        v_owner_id,
        v_owner_id,
        'Platform owner access repaired by migration 0029 after auth role-clobber fix.',
        true
      )
      ON CONFLICT (user_id) DO UPDATE
      SET is_active = true,
          reason = EXCLUDED.reason,
          granted_at = now();
    END IF;

    IF to_regclass('public.audit_logs') IS NOT NULL THEN
      INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
      VALUES (
        v_owner_id,
        'role_changed',
        'profile',
        v_owner_id,
        jsonb_build_object(
          'email', v_owner_email,
          'role', 'super_admin',
          'reason', 'owner_access_repaired',
          'migration', '0029_auth_role_repair_and_owner_access'
        )
      );
    END IF;
  END IF;
END $$;
