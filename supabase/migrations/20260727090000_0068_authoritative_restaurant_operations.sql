-- Authoritative, concurrency-safe restaurant availability controls.
-- Additive and data-preserving: no existing restaurant or order rows are rewritten.

CREATE OR REPLACE FUNCTION public.update_restaurant_operational_state(
  p_actor_id uuid,
  p_restaurant_id uuid,
  p_operational_status text DEFAULT NULL,
  p_vacation_mode boolean DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_previous_status text;
  v_previous_vacation boolean;
BEGIN
  IF p_actor_id IS NULL OR p_restaurant_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Restaurant, actor, and current version are required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_operational_status IS NULL AND p_vacation_mode IS NULL THEN
    RAISE EXCEPTION 'No operational change was provided.'
      USING ERRCODE = '22023';
  END IF;

  IF p_operational_status IS NOT NULL
     AND p_operational_status NOT IN ('open', 'busy', 'closed') THEN
    RAISE EXCEPTION 'Invalid restaurant operational status.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_actor_id
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'An active account is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT restaurant.*
  INTO v_restaurant
  FROM public.restaurants AS restaurant
  WHERE restaurant.id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_restaurant.owner_id <> p_actor_id
     AND NOT EXISTS (
       SELECT 1
       FROM public.restaurant_memberships AS membership
       WHERE membership.restaurant_id = p_restaurant_id
         AND membership.user_id = p_actor_id
         AND membership.status = 'active'
         AND membership.membership_role IN ('owner', 'manager')
     ) THEN
    RAISE EXCEPTION 'Only an authorized restaurant owner or manager can change availability.'
      USING ERRCODE = '42501';
  END IF;

  IF v_restaurant.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Restaurant availability changed in another session. Refresh before trying again.'
      USING ERRCODE = '40001';
  END IF;

  v_previous_status := v_restaurant.operational_status;
  v_previous_vacation := COALESCE(v_restaurant.is_vacation_mode, false);

  UPDATE public.restaurants AS restaurant
  SET operational_status = COALESCE(p_operational_status, restaurant.operational_status),
      is_vacation_mode = COALESCE(p_vacation_mode, restaurant.is_vacation_mode),
      updated_at = now()
  WHERE restaurant.id = p_restaurant_id
  RETURNING restaurant.* INTO v_restaurant;

  IF v_previous_status IS DISTINCT FROM v_restaurant.operational_status
     OR v_previous_vacation IS DISTINCT FROM v_restaurant.is_vacation_mode THEN
    INSERT INTO public.audit_logs (
      actor_id,
      action,
      target_type,
      target_id,
      metadata
    )
    VALUES (
      p_actor_id,
      'restaurant_updated',
      'restaurant',
      p_restaurant_id,
      jsonb_build_object(
        'change', 'operational_availability',
        'previous_operational_status', v_previous_status,
        'operational_status', v_restaurant.operational_status,
        'previous_vacation_mode', v_previous_vacation,
        'vacation_mode', v_restaurant.is_vacation_mode
      )
    );
  END IF;

  RETURN to_jsonb(v_restaurant);
END;
$$;

COMMENT ON FUNCTION public.update_restaurant_operational_state(
  uuid,
  uuid,
  text,
  boolean,
  timestamptz
) IS
  'Trusted server action for audited, optimistic-concurrency-safe restaurant availability changes.';

REVOKE ALL ON FUNCTION public.update_restaurant_operational_state(
  uuid,
  uuid,
  text,
  boolean,
  timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_restaurant_operational_state(
  uuid,
  uuid,
  text,
  boolean,
  timestamptz
) TO service_role;
