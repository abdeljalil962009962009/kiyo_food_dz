-- Repair admin suspension and lifecycle controls after live production E2E.
-- Safe, additive migration: no data deletion, no table rewrites.

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'user_suspended';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'user_restored';

CREATE OR REPLACE FUNCTION public.set_user_suspended(
  p_user_id uuid,
  p_suspended boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: admin only' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_suspend_self' USING ERRCODE = 'P0001';
  END IF;
  IF p_suspended AND length(trim(COALESCE(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'A suspension reason is required.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles SET
    is_suspended = p_suspended,
    suspended_reason = CASE WHEN p_suspended THEN trim(p_reason) ELSE NULL END,
    suspended_at = CASE WHEN p_suspended THEN now() ELSE NULL END
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.log_activity(
    (CASE WHEN p_suspended THEN 'user_suspended' ELSE 'user_restored' END)::public.audit_action,
    'user',
    p_user_id,
    jsonb_build_object('reason', p_reason)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_restaurant_application(
  p_application_id uuid,
  p_target_status text,
  p_reason text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
)
RETURNS public.restaurant_applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application public.restaurant_applications%ROWTYPE;
  v_old_status text;
  v_allowed boolean := false;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the platform owner can review applications.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_application
  FROM public.restaurant_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF p_expected_version IS NOT NULL AND v_application.application_version <> p_expected_version THEN
    RAISE EXCEPTION 'This application changed in another session. Reload before acting.' USING ERRCODE = '40001';
  END IF;

  v_allowed :=
    (v_application.status IN ('submitted','resubmitted') AND p_target_status = 'under_review')
    OR (v_application.status = 'under_review' AND p_target_status IN ('changes_requested','rejected'))
    OR (v_application.status IN ('onboarding_in_progress','menu_review') AND p_target_status = 'changes_requested')
    OR (v_application.status = 'onboarding_in_progress' AND p_target_status = 'menu_review')
    OR (v_application.status = 'menu_review' AND p_target_status = 'ready_to_publish')
    OR (v_application.status IN ('preliminarily_approved','onboarding_in_progress','menu_review','ready_to_publish','published') AND p_target_status = 'suspended')
    OR (v_application.status = 'suspended' AND p_target_status = 'onboarding_in_progress')
    OR (p_target_status = 'archived' AND v_application.status <> 'published');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid application transition: % -> %', v_application.status, p_target_status USING ERRCODE = '22023';
  END IF;

  IF p_target_status IN ('changes_requested','rejected','suspended') AND length(trim(COALESCE(p_reason,''))) < 3 THEN
    RAISE EXCEPTION 'A clear reason is required.' USING ERRCODE = '22023';
  END IF;

  v_old_status := v_application.status;

  UPDATE public.restaurant_applications
  SET status = p_target_status,
      changes_requested_reason = CASE WHEN p_target_status = 'changes_requested' THEN trim(p_reason) ELSE changes_requested_reason END,
      rejection_reason = CASE WHEN p_target_status = 'rejected' THEN trim(p_reason) ELSE rejection_reason END,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      application_version = application_version + 1,
      last_transition_at = now(),
      updated_at = now()
  WHERE id = p_application_id
  RETURNING * INTO v_application;

  IF v_application.restaurant_id IS NOT NULL AND p_target_status = 'suspended' THEN
    UPDATE public.restaurants
    SET status = 'suspended', updated_at = now()
    WHERE id = v_application.restaurant_id;
  ELSIF v_application.restaurant_id IS NOT NULL
        AND v_old_status = 'suspended'
        AND p_target_status = 'onboarding_in_progress' THEN
    UPDATE public.restaurants
    SET status = 'pending_approval', updated_at = now()
    WHERE id = v_application.restaurant_id;
  END IF;

  INSERT INTO public.restaurant_application_transitions (
    application_id, from_status, to_status, actor_id, actor_role, reason, metadata
  ) VALUES (
    p_application_id,
    v_old_status,
    p_target_status,
    auth.uid(),
    'super_admin',
    NULLIF(trim(p_reason), ''),
    jsonb_build_object('version', v_application.application_version)
  );

  PERFORM public.notify_user(
    v_application.applicant_id,
    CASE WHEN p_target_status = 'changes_requested' THEN 'application_changes_requested' ELSE 'application_status_changed' END,
    CASE p_target_status
      WHEN 'under_review' THEN 'Your restaurant application is under review'
      WHEN 'changes_requested' THEN 'Changes requested for your restaurant application'
      WHEN 'rejected' THEN 'Restaurant application decision'
      WHEN 'menu_review' THEN 'Your menu is being reviewed'
      WHEN 'ready_to_publish' THEN 'Restaurant setup is ready for final review'
      WHEN 'suspended' THEN 'Restaurant suspended'
      ELSE 'Restaurant application updated'
    END,
    COALESCE(NULLIF(trim(p_reason), ''), v_application.restaurant_name),
    jsonb_build_object('application_id', p_application_id, 'status', p_target_status, 'restaurant_name', v_application.restaurant_name)
  );

  PERFORM public.log_activity(
    'admin_action',
    'restaurant_application',
    p_application_id,
    jsonb_build_object(
      'action', 'application_transition',
      'from', v_old_status,
      'to', p_target_status,
      'reason', p_reason,
      'version', v_application.application_version
    )
  );

  RETURN v_application;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.review_restaurant_application(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_restaurant_application(uuid, text, text, integer) TO authenticated;
