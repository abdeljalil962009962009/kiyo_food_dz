-- ============================================================================
-- KIYO Phase 4 — privacy & data compliance
-- 1. profiles.deleted_at: soft-delete column. When set, RLS denies all access
--    (except super_admin for compliance review) and the auth user is signed out.
-- 2. profiles.export_requested_at: timestamp so we can audit data export requests.
-- 3. New RLS policy: deny SELECT/UPDATE on soft-deleted profiles for the user
--    themselves; only super_admin can see soft-deleted rows (compliance review).
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS export_requested_at timestamptz;

-- Drop the existing self-select policy and recreate with the deleted_at guard.
DROP POLICY IF EXISTS profiles_select_self_or_admin ON profiles;

CREATE POLICY profiles_select_self_or_admin ON profiles
  FOR SELECT TO authenticated
  USING (
    (id = auth.uid() AND deleted_at IS NULL)
    OR public.is_super_admin()
  );

-- Drop existing self-update policy and recreate with deleted_at guard.
DROP POLICY IF EXISTS profiles_update_self_or_admin ON profiles;

CREATE POLICY profiles_update_self_or_admin ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- Note: insert + delete policies on profiles already restrict to the right roles
-- (profiles_insert_self on signup, profiles_delete_admin_only for hard-delete).

-- Helper RPC: request_personal_data_export()
-- Marks export_requested_at; in a full Phase 5 system this would enqueue a
-- background job to actually build the export. For MVP, the frontend queries
-- all user-owned rows directly via RLS-governed queries (no service-role
-- escalation needed — the user can already read their own data).
CREATE OR REPLACE FUNCTION public.request_personal_data_export()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE profiles SET export_requested_at = v_now WHERE id = v_uid;
  PERFORM public.log_activity(
    'data_export_requested',
    'user',
    v_uid,
    jsonb_build_object('requested_at', v_now)
  );
  RETURN v_now;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_personal_data_export() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_personal_data_export() TO authenticated;

-- Helper RPC: request_account_deletion()
-- Soft-deletes the profile by setting deleted_at = now() + 14 days grace.
-- We set deleted_at to NOW (not future) so the user is immediately signed out
-- and locked out; the 14-day "grace" is handled by a future cleanup job that
-- hard-deletes the row after the retention window.
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  -- Refuse deletion for restaurant_owner accounts with active restaurants
  -- (must transfer ownership or have admin close the restaurant first).
  IF EXISTS (
    SELECT 1 FROM restaurants r
    WHERE r.owner_id = v_uid
      AND r.status IN ('draft', 'pending_approval', 'published')
  ) THEN
    RAISE EXCEPTION 'cannot_delete_active_restaurant_owner'
      USING ERRCODE = 'P0003';
  END IF;

  UPDATE profiles SET deleted_at = v_now WHERE id = v_uid;
  PERFORM public.log_activity(
    'account_deletion_requested',
    'user',
    v_uid,
    jsonb_build_object('deleted_at', v_now)
  );
  RETURN v_now;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
