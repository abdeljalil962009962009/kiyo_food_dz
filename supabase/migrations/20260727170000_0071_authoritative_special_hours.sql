-- Make exceptional restaurant schedules validated, auditable and server-authoritative.
-- Existing rows and public read/realtime behavior are preserved.

BEGIN;

ALTER TABLE public.restaurant_special_hours
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.restaurant_special_hours'::regclass
      AND conname = 'restaurant_special_hours_reason_length'
  ) THEN
    ALTER TABLE public.restaurant_special_hours
      ADD CONSTRAINT restaurant_special_hours_reason_length
      CHECK (reason IS NULL OR length(reason) <= 240) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.restaurant_special_hours'::regclass
      AND conname = 'restaurant_special_hours_valid_times'
  ) THEN
    ALTER TABLE public.restaurant_special_hours
      ADD CONSTRAINT restaurant_special_hours_valid_times
      CHECK (
        (is_closed AND open_time IS NULL AND close_time IS NULL)
        OR
        (NOT is_closed AND open_time IS NOT NULL AND close_time IS NOT NULL AND open_time <> close_time)
      ) NOT VALID;
  END IF;
END
$constraints$;

DROP POLICY IF EXISTS special_hours_modify ON public.restaurant_special_hours;
DROP POLICY IF EXISTS special_hours_manager_select ON public.restaurant_special_hours;
CREATE POLICY special_hours_manager_select
  ON public.restaurant_special_hours
  FOR SELECT
  TO authenticated
  USING (public.can_manage_restaurant(restaurant_id));

CREATE OR REPLACE FUNCTION public.upsert_restaurant_special_hours(
  p_actor_id uuid,
  p_restaurant_id uuid,
  p_date date,
  p_is_closed boolean,
  p_open_time time,
  p_close_time time,
  p_reason text,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_existing public.restaurant_special_hours%ROWTYPE;
  v_result public.restaurant_special_hours%ROWTYPE;
  v_is_admin boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = p_actor_id
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'An active account is required.' USING ERRCODE = '42501';
  END IF;

  SELECT profile.role = 'super_admin'
  INTO v_is_admin
  FROM public.profiles AS profile
  WHERE profile.id = p_actor_id
    AND NOT COALESCE(profile.is_suspended, false);

  IF NOT COALESCE(v_is_admin, false)
     AND NOT EXISTS (
       SELECT 1
       FROM public.restaurants AS restaurant
       LEFT JOIN public.restaurant_memberships AS membership
         ON membership.restaurant_id = restaurant.id
        AND membership.user_id = p_actor_id
        AND membership.status = 'active'
        AND membership.membership_role IN ('owner', 'manager')
       WHERE restaurant.id = p_restaurant_id
         AND (restaurant.owner_id = p_actor_id OR membership.user_id IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'Only an authorized owner, manager or platform owner can change exceptional hours.'
      USING ERRCODE = '42501';
  END IF;

  IF p_restaurant_id IS NULL
     OR p_date IS NULL
     OR p_is_closed IS NULL
     OR p_date < (now() AT TIME ZONE 'Africa/Algiers')::date
     OR length(COALESCE(p_reason, '')) > 240
     OR (
       p_is_closed
       AND (p_open_time IS NOT NULL OR p_close_time IS NOT NULL)
     )
     OR (
       NOT p_is_closed
       AND (p_open_time IS NULL OR p_close_time IS NULL OR p_open_time = p_close_time)
     ) THEN
    RAISE EXCEPTION 'Exceptional hours are invalid.' USING ERRCODE = '22023';
  END IF;

  SELECT special.*
  INTO v_existing
  FROM public.restaurant_special_hours AS special
  WHERE special.restaurant_id = p_restaurant_id
    AND special.date = p_date
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_updated_at IS NULL
       OR v_existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Exceptional hours changed in another session. Refresh before saving.'
        USING ERRCODE = '40001';
    END IF;

    UPDATE public.restaurant_special_hours AS special
    SET is_closed = p_is_closed,
        open_time = CASE WHEN p_is_closed THEN NULL ELSE p_open_time END,
        close_time = CASE WHEN p_is_closed THEN NULL ELSE p_close_time END,
        reason = NULLIF(trim(COALESCE(p_reason, '')), ''),
        updated_at = now(),
        updated_by = p_actor_id
    WHERE special.id = v_existing.id
    RETURNING special.* INTO v_result;
  ELSE
    INSERT INTO public.restaurant_special_hours (
      restaurant_id, date, is_closed, open_time, close_time, reason, updated_by
    )
    VALUES (
      p_restaurant_id,
      p_date,
      p_is_closed,
      CASE WHEN p_is_closed THEN NULL ELSE p_open_time END,
      CASE WHEN p_is_closed THEN NULL ELSE p_close_time END,
      NULLIF(trim(COALESCE(p_reason, '')), ''),
      p_actor_id
    )
    RETURNING * INTO v_result;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    p_actor_id,
    'restaurant_updated',
    'restaurant',
    p_restaurant_id,
    jsonb_build_object(
      'change', 'special_hours_saved',
      'special_hours_id', v_result.id,
      'date', v_result.date,
      'is_closed', v_result.is_closed,
      'previous', CASE WHEN v_existing.id IS NULL THEN NULL ELSE to_jsonb(v_existing) END,
      'current', to_jsonb(v_result)
    )
  );

  RETURN to_jsonb(v_result);
END
$function$;

CREATE OR REPLACE FUNCTION public.delete_restaurant_special_hours(
  p_actor_id uuid,
  p_restaurant_id uuid,
  p_special_hours_id uuid,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_existing public.restaurant_special_hours%ROWTYPE;
  v_is_admin boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS profile
    WHERE profile.id = p_actor_id
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'An active account is required.' USING ERRCODE = '42501';
  END IF;

  SELECT profile.role = 'super_admin'
  INTO v_is_admin
  FROM public.profiles AS profile
  WHERE profile.id = p_actor_id
    AND NOT COALESCE(profile.is_suspended, false);

  IF NOT COALESCE(v_is_admin, false)
     AND NOT EXISTS (
       SELECT 1
       FROM public.restaurants AS restaurant
       LEFT JOIN public.restaurant_memberships AS membership
         ON membership.restaurant_id = restaurant.id
        AND membership.user_id = p_actor_id
        AND membership.status = 'active'
        AND membership.membership_role IN ('owner', 'manager')
       WHERE restaurant.id = p_restaurant_id
         AND (restaurant.owner_id = p_actor_id OR membership.user_id IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'Only an authorized owner, manager or platform owner can remove exceptional hours.'
      USING ERRCODE = '42501';
  END IF;

  SELECT special.*
  INTO v_existing
  FROM public.restaurant_special_hours AS special
  WHERE special.id = p_special_hours_id
    AND special.restaurant_id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exceptional hours were not found.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_updated_at IS NULL
     OR v_existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Exceptional hours changed in another session. Refresh before removing.'
      USING ERRCODE = '40001';
  END IF;

  DELETE FROM public.restaurant_special_hours
  WHERE id = v_existing.id;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    p_actor_id,
    'restaurant_updated',
    'restaurant',
    p_restaurant_id,
    jsonb_build_object(
      'change', 'special_hours_removed',
      'special_hours_id', v_existing.id,
      'previous', to_jsonb(v_existing)
    )
  );

  RETURN jsonb_build_object('deleted', true, 'id', v_existing.id);
END
$function$;

REVOKE ALL ON FUNCTION public.upsert_restaurant_special_hours(uuid, uuid, date, boolean, time, time, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_restaurant_special_hours(uuid, uuid, date, boolean, time, time, text, timestamptz)
  TO service_role;

REVOKE ALL ON FUNCTION public.delete_restaurant_special_hours(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_restaurant_special_hours(uuid, uuid, uuid, timestamptz)
  TO service_role;

COMMIT;
