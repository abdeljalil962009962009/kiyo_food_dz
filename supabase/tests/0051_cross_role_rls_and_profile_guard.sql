-- Rollback-isolated role/RLS acceptance checks. This script temporarily uses
-- existing staging identities and always rolls back its fixture changes.
-- Run only after migration 0051 succeeds in Kiyo Food Staging.
BEGIN;

DO $preflight$
DECLARE
  v_admin_id uuid;
  v_application_id uuid;
  v_original_applicant_id uuid;
  v_restaurant_id uuid;
  v_owner_id uuid;
  v_fixture_user_id uuid;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE role = 'super_admin' AND NOT COALESCE(is_suspended, false)
  ORDER BY created_at
  LIMIT 1;

  SELECT application.id, application.applicant_id
  INTO v_application_id, v_original_applicant_id
  FROM public.restaurant_applications application
  ORDER BY application.created_at DESC
  LIMIT 1;

  SELECT membership.restaurant_id, membership.user_id
  INTO v_restaurant_id, v_owner_id
  FROM public.restaurant_memberships membership
  WHERE membership.membership_role = 'owner' AND membership.status = 'active'
  ORDER BY membership.created_at
  LIMIT 1;

  SELECT profile.id INTO v_fixture_user_id
  FROM public.profiles profile
  WHERE profile.role <> 'super_admin'
    AND NOT COALESCE(profile.is_suspended, false)
    AND profile.id <> v_owner_id
    AND NOT EXISTS (
      SELECT 1 FROM public.restaurant_memberships membership
      WHERE membership.restaurant_id = v_restaurant_id
        AND membership.user_id = profile.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.restaurant_applications application
      WHERE application.applicant_id = profile.id
    )
  ORDER BY profile.created_at DESC
  LIMIT 1;

  IF v_admin_id IS NULL OR v_application_id IS NULL OR v_original_applicant_id IS NULL
     OR v_restaurant_id IS NULL OR v_owner_id IS NULL OR v_fixture_user_id IS NULL THEN
    RAISE EXCEPTION
      '0051 requires an active super admin, application, owner membership, and separate non-admin staging profile';
  END IF;

  PERFORM set_config('kiyo.test.admin_id', v_admin_id::text, true);
  PERFORM set_config('kiyo.test.application_id', v_application_id::text, true);
  PERFORM set_config('kiyo.test.original_applicant_id', v_original_applicant_id::text, true);
  PERFORM set_config('kiyo.test.applicant_id', v_fixture_user_id::text, true);
  PERFORM set_config('kiyo.test.restaurant_id', v_restaurant_id::text, true);
  PERFORM set_config('kiyo.test.owner_id', v_fixture_user_id::text, true);
  PERFORM set_config('kiyo.test.fixture_user_id', v_fixture_user_id::text, true);

  -- Reuse existing rows as rollback-only fixtures so no permanent staging
  -- accounts or duplicate applications are created.
  UPDATE public.profiles
  SET role = 'customer'::public.user_role
  WHERE id = v_fixture_user_id;
  UPDATE public.restaurant_applications
  SET applicant_id = v_fixture_user_id
  WHERE id = v_application_id;

  INSERT INTO public.restaurant_memberships (
    restaurant_id, user_id, membership_role, status, invited_by
  ) VALUES (
    v_restaurant_id, v_fixture_user_id, 'manager', 'active', v_admin_id
  );
END
$preflight$;

SET LOCAL ROLE authenticated;

-- A restaurant manager can manage only the restaurant granted by membership.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('kiyo.test.fixture_user_id'),
    'role', 'authenticated'
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('kiyo.test.fixture_user_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $manager_checks$
DECLARE
  v_user_id uuid := current_setting('kiyo.test.fixture_user_id')::uuid;
  v_restaurant_id uuid := current_setting('kiyo.test.restaurant_id')::uuid;
  v_rows integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION '0051 failed: authenticated identity simulation is invalid';
  END IF;
  IF public.is_super_admin() THEN
    RAISE EXCEPTION '0051 failed: a non-admin profile inherited super-admin access';
  END IF;
  IF NOT public.can_manage_restaurant(v_restaurant_id) THEN
    RAISE EXCEPTION '0051 failed: active manager membership cannot manage its restaurant';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_memberships membership
    WHERE membership.restaurant_id = v_restaurant_id
      AND membership.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION '0051 failed: manager cannot read their own membership';
  END IF;

  UPDATE public.restaurants
  SET updated_at = updated_at
  WHERE id = v_restaurant_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION '0051 failed: manager update policy did not authorize its restaurant';
  END IF;

  BEGIN
    UPDATE public.profiles SET role = 'super_admin' WHERE id = v_user_id;
    RAISE EXCEPTION '0051 failed: user changed their own role';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    UPDATE public.profiles SET is_suspended = true WHERE id = v_user_id;
    RAISE EXCEPTION '0051 failed: user changed their own suspension state';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  UPDATE public.profiles
  SET preferred_language = preferred_language
  WHERE id = v_user_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION '0051 failed: safe self-service profile updates are blocked';
  END IF;
END
$manager_checks$;

RESET ROLE;

-- Revoke the temporary membership and temporarily classify the fixture as a
-- driver. Both changes are rolled back at the end of this script.
UPDATE public.restaurant_memberships
SET status = 'revoked', updated_at = now()
WHERE restaurant_id = current_setting('kiyo.test.restaurant_id')::uuid
  AND user_id = current_setting('kiyo.test.fixture_user_id')::uuid;
UPDATE public.profiles
SET role = 'driver'::public.user_role
WHERE id = current_setting('kiyo.test.fixture_user_id')::uuid;
UPDATE public.restaurant_applications
SET applicant_id = current_setting('kiyo.test.original_applicant_id')::uuid
WHERE id = current_setting('kiyo.test.application_id')::uuid;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('kiyo.test.fixture_user_id'),
    'role', 'authenticated',
    'user_role', 'super_admin'
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('kiyo.test.fixture_user_id'), true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $driver_and_spoof_checks$
DECLARE
  v_restaurant_id uuid := current_setting('kiyo.test.restaurant_id')::uuid;
  v_application_id uuid := current_setting('kiyo.test.application_id')::uuid;
  v_rows integer;
  v_denied boolean := false;
BEGIN
  IF public.is_super_admin() THEN
    RAISE EXCEPTION '0051 failed: a forged JWT role granted super-admin access';
  END IF;
  IF public.can_manage_restaurant(v_restaurant_id) THEN
    RAISE EXCEPTION '0051 failed: a driver without membership can manage a restaurant';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.restaurant_applications application
    WHERE application.id = v_application_id
  ) THEN
    RAISE EXCEPTION '0051 failed: unrelated driver can read a private application';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.restaurant_memberships membership
    WHERE membership.restaurant_id = v_restaurant_id
  ) THEN
    RAISE EXCEPTION '0051 failed: unrelated driver can read restaurant memberships';
  END IF;

  UPDATE public.restaurants SET updated_at = updated_at WHERE id = v_restaurant_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '0051 failed: unrelated driver updated a restaurant';
  END IF;

  BEGIN
    PERFORM count(*) FROM public.owner_action_requests;
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  IF NOT v_denied THEN
    RAISE EXCEPTION '0051 failed: browser role can inspect owner action requests';
  END IF;
END
$driver_and_spoof_checks$;

-- The applicant can read their own application but cannot bypass the trusted
-- resubmission/state-transition RPC with a direct table update.
RESET ROLE;
UPDATE public.profiles
SET role = 'customer'::public.user_role
WHERE id = current_setting('kiyo.test.fixture_user_id')::uuid;
UPDATE public.restaurant_applications
SET applicant_id = current_setting('kiyo.test.fixture_user_id')::uuid
WHERE id = current_setting('kiyo.test.application_id')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('kiyo.test.applicant_id'),
    'role', 'authenticated'
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('kiyo.test.applicant_id'), true);

DO $applicant_checks$
DECLARE
  v_application_id uuid := current_setting('kiyo.test.application_id')::uuid;
  v_rows integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_applications application
    WHERE application.id = v_application_id
  ) THEN
    RAISE EXCEPTION '0051 failed: applicant cannot read their own application';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_application_transitions transition
    WHERE transition.application_id = v_application_id
  ) THEN
    RAISE EXCEPTION '0051 failed: applicant cannot read their application timeline';
  END IF;

  BEGIN
    UPDATE public.restaurant_applications
    SET internal_notes = internal_notes
    WHERE id = v_application_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rows := 0;
  END;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '0051 failed: applicant bypassed the trusted application workflow';
  END IF;
END
$applicant_checks$;

-- An active owner membership grants restaurant access without granting
-- platform-wide profile visibility.
RESET ROLE;
UPDATE public.restaurant_memberships
SET membership_role = 'owner', status = 'active', updated_at = now()
WHERE restaurant_id = current_setting('kiyo.test.restaurant_id')::uuid
  AND user_id = current_setting('kiyo.test.fixture_user_id')::uuid;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('kiyo.test.owner_id'),
    'role', 'authenticated'
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('kiyo.test.owner_id'), true);

DO $owner_checks$
DECLARE
  v_restaurant_id uuid := current_setting('kiyo.test.restaurant_id')::uuid;
BEGIN
  IF NOT public.can_manage_restaurant(v_restaurant_id) THEN
    RAISE EXCEPTION '0051 failed: active restaurant owner cannot manage their restaurant';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles profile
    WHERE profile.id <> auth.uid()
  ) THEN
    RAISE EXCEPTION '0051 failed: restaurant owner can read another private profile';
  END IF;
END
$owner_checks$;

-- The database-backed super-admin role can review platform records. The test
-- does not trust JWT metadata to establish this permission.
SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', current_setting('kiyo.test.admin_id'),
    'role', 'authenticated'
  )::text,
  true
);
SELECT set_config('request.jwt.claim.sub', current_setting('kiyo.test.admin_id'), true);

DO $admin_checks$
DECLARE
  v_application_id uuid := current_setting('kiyo.test.application_id')::uuid;
  v_restaurant_id uuid := current_setting('kiyo.test.restaurant_id')::uuid;
  v_rows integer;
BEGIN
  IF NOT public.is_super_admin() OR NOT public.can_manage_restaurant(v_restaurant_id) THEN
    RAISE EXCEPTION '0051 failed: active database super admin lacks platform access';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_applications application
    WHERE application.id = v_application_id
  ) THEN
    RAISE EXCEPTION '0051 failed: super admin cannot review applications';
  END IF;

  BEGIN
    UPDATE public.restaurant_applications
    SET internal_notes = internal_notes
    WHERE id = v_application_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN
    v_rows := 0;
  END;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION '0051 failed: admin bypassed the trusted application workflow';
  END IF;
END
$admin_checks$;

RESET ROLE;
ROLLBACK;

SELECT '0051 cross-role RLS and profile guard assertions passed' AS result;
