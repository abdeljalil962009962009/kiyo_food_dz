-- Require an actual weekly schedule before a restaurant can be published.
-- Legacy application notes are still preserved, but no longer count as valid
-- opening hours by themselves.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_restaurant_publication_readiness(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_application public.restaurant_applications%ROWTYPE;
  v_blockers jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_restaurant FROM public.restaurants WHERE id = p_restaurant_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ready', false, 'blockers', jsonb_build_array('Restaurant does not exist.'));
  END IF;

  IF NOT public.is_super_admin()
     AND NOT EXISTS (
       SELECT 1 FROM public.restaurant_memberships m
       WHERE m.restaurant_id = p_restaurant_id AND m.user_id = auth.uid() AND m.status = 'active'
     ) THEN
    RAISE EXCEPTION 'Not allowed to inspect this restaurant.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_application FROM public.restaurant_applications
  WHERE restaurant_id = p_restaurant_id LIMIT 1;

  IF v_restaurant.source_application_id IS NOT NULL
     AND (v_application.id IS NULL OR v_application.status NOT IN ('onboarding_in_progress','menu_review','ready_to_publish','published','suspended')) THEN
    v_blockers := v_blockers || jsonb_build_array('Application has not completed preliminary approval.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_memberships m
    WHERE m.restaurant_id = p_restaurant_id AND m.membership_role = 'owner' AND m.status = 'active'
  ) THEN
    v_blockers := v_blockers || jsonb_build_array('No active restaurant owner membership exists.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.restaurant_commercial_terms t
    WHERE t.restaurant_id = p_restaurant_id AND t.status = 'active'
      AND t.effective_at <= now() AND (t.expires_at IS NULL OR t.expires_at > now())
  ) THEN
    v_blockers := v_blockers || jsonb_build_array('Commercial terms are not approved and active.');
  END IF;
  IF length(trim(COALESCE(v_restaurant.name,''))) < 2 THEN
    v_blockers := v_blockers || jsonb_build_array('Public restaurant name is missing.');
  END IF;
  IF length(trim(COALESCE(v_restaurant.phone,''))) < 6 THEN
    v_blockers := v_blockers || jsonb_build_array('Restaurant contact phone is missing.');
  END IF;
  IF length(trim(COALESCE(v_restaurant.address,''))) < 5 THEN
    v_blockers := v_blockers || jsonb_build_array('Restaurant address is missing.');
  END IF;
  IF NOT COALESCE(v_restaurant.location_verified, false)
     OR NOT public.kiyo_is_coordinate_in_algeria(v_restaurant.latitude, v_restaurant.longitude) THEN
    v_blockers := v_blockers || jsonb_build_array('Restaurant coordinates are missing or unverified.');
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_each(COALESCE(v_restaurant.opening_hours, '{}'::jsonb)) AS schedule(day_key, hours)
    WHERE schedule.day_key ~ '^[0-6]$'
      AND jsonb_typeof(schedule.hours) = 'object'
      AND COALESCE(schedule.hours->>'open', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND COALESCE(schedule.hours->>'close', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND schedule.hours->>'open' IS DISTINCT FROM schedule.hours->>'close'
  ) THEN
    v_blockers := v_blockers || jsonb_build_array('Opening hours are not configured.');
  END IF;
  IF length(trim(COALESCE(v_restaurant.image_url,''))) < 8
     OR v_restaurant.image_url !~* '^https://' THEN
    v_blockers := v_blockers || jsonb_build_array('A public restaurant image or logo is required.');
  END IF;
  IF COALESCE(v_restaurant.max_delivery_km, 0) <= 0 THEN
    v_blockers := v_blockers || jsonb_build_array('Delivery coverage is not configured.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.menu_categories c WHERE c.restaurant_id = p_restaurant_id) THEN
    v_blockers := v_blockers || jsonb_build_array('No menu category exists.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.menu_items i
    WHERE i.restaurant_id = p_restaurant_id AND i.is_available = true
      AND i.price > 0 AND length(trim(COALESCE(i.name,''))) >= 2
  ) THEN
    v_blockers := v_blockers || jsonb_build_array('No active, correctly priced dish exists.');
  END IF;
  IF v_application.id IS NOT NULL
     AND v_application.changes_requested_reason IS NOT NULL
     AND v_application.status = 'changes_requested' THEN
    v_blockers := v_blockers || jsonb_build_array('A blocking change request is unresolved.');
  END IF;

  RETURN jsonb_build_object(
    'ready', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers,
    'restaurant_id', p_restaurant_id,
    'application_id', v_application.id,
    'checked_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_restaurant_publication_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_publication_readiness(uuid) TO authenticated;

COMMIT;
