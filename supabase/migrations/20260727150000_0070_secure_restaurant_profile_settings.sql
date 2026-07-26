-- Secure restaurant profile, schedule and precise-location updates.
-- Browser roles keep read access, while all restaurant-row writes now pass
-- through reviewed server actions or trusted database functions.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_direct_restaurant_updates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Restaurant settings must be changed through the secure settings service.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_guard_direct_restaurant_updates
  ON public.restaurants;
CREATE TRIGGER trg_guard_direct_restaurant_updates
  BEFORE UPDATE
  ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_direct_restaurant_updates();

REVOKE ALL ON FUNCTION public.guard_direct_restaurant_updates()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_restaurant_profile_settings(
  p_actor_id uuid,
  p_restaurant_id uuid,
  p_payload jsonb,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_result public.restaurants%ROWTYPE;
  v_allowed_keys text[] := ARRAY[
    'name',
    'description',
    'phone',
    'cuisine',
    'image_url',
    'opening_hours',
    'estimated_delivery_min',
    'address',
    'latitude',
    'longitude',
    'location_accuracy_m',
    'location_source',
    'place_id',
    'street',
    'neighborhood',
    'commune',
    'city',
    'province',
    'postal_code',
    'country',
    'wilaya_id'
  ];
  v_location_keys text[] := ARRAY[
    'address',
    'latitude',
    'longitude',
    'location_accuracy_m',
    'location_source',
    'place_id',
    'street',
    'neighborhood',
    'commune',
    'city',
    'province',
    'postal_code',
    'country',
    'wilaya_id'
  ];
  v_location_requested boolean;
  v_hours_entry record;
  v_cuisine_count integer;
  v_hours_count integer;
  v_image_url text;
  v_changed_fields text[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_actor_id IS NULL
     OR p_restaurant_id IS NULL
     OR p_expected_updated_at IS NULL
     OR p_payload IS NULL
     OR jsonb_typeof(p_payload) <> 'object'
     OR p_payload = '{}'::jsonb
     OR p_payload - v_allowed_keys <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Restaurant settings payload is invalid.'
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
    RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_restaurant.owner_id IS DISTINCT FROM p_actor_id
     AND NOT EXISTS (
       SELECT 1
       FROM public.restaurant_memberships AS membership
       WHERE membership.restaurant_id = p_restaurant_id
         AND membership.user_id = p_actor_id
         AND membership.status = 'active'
         AND membership.membership_role IN ('owner', 'manager')
     ) THEN
    RAISE EXCEPTION 'Only an authorized owner or manager can update this restaurant.'
      USING ERRCODE = '42501';
  END IF;

  IF v_restaurant.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Restaurant settings changed in another session. Refresh before saving.'
      USING ERRCODE = '40001';
  END IF;

  IF p_payload ? 'name'
     AND (
       length(trim(COALESCE(p_payload->>'name', ''))) < 2
       OR length(trim(p_payload->>'name')) > 120
     ) THEN
    RAISE EXCEPTION 'Restaurant name must contain between 2 and 120 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'description'
     AND length(COALESCE(p_payload->>'description', '')) > 1500 THEN
    RAISE EXCEPTION 'Restaurant description is too long.'
      USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'phone'
     AND COALESCE(p_payload->>'phone', '') !~ '^[+0-9() .-]{6,24}$' THEN
    RAISE EXCEPTION 'Restaurant contact phone is invalid.'
      USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'cuisine' THEN
    IF jsonb_typeof(p_payload->'cuisine') <> 'array'
       OR jsonb_array_length(p_payload->'cuisine') > 12 THEN
      RAISE EXCEPTION 'Restaurant cuisine list is invalid.'
        USING ERRCODE = '22023';
    END IF;
    SELECT count(*)
    INTO v_cuisine_count
    FROM jsonb_array_elements_text(p_payload->'cuisine') AS cuisine(value)
    WHERE length(trim(cuisine.value)) BETWEEN 1 AND 60;
    IF v_cuisine_count <> jsonb_array_length(p_payload->'cuisine') THEN
      RAISE EXCEPTION 'Every cuisine label must contain between 1 and 60 characters.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_payload ? 'image_url' THEN
    v_image_url := NULLIF(trim(p_payload->>'image_url'), '');
    IF v_image_url IS DISTINCT FROM v_restaurant.image_url
       AND (
         length(COALESCE(v_image_url, '')) > 600
         OR (
           v_image_url IS NOT NULL
           AND v_image_url !~ '^https://'
           AND v_image_url !~ ('^' || p_actor_id::text || '/[A-Za-z0-9._/-]+$')
         )
         OR position('..' IN COALESCE(v_image_url, '')) > 0
       ) THEN
      RAISE EXCEPTION 'Restaurant image reference is invalid.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_payload ? 'estimated_delivery_min'
     AND (
       (p_payload->>'estimated_delivery_min')::integer < 10
       OR (p_payload->>'estimated_delivery_min')::integer > 120
     ) THEN
    RAISE EXCEPTION 'Estimated delivery time must be between 10 and 120 minutes.'
      USING ERRCODE = '22023';
  END IF;

  IF p_payload ? 'opening_hours' THEN
    IF jsonb_typeof(p_payload->'opening_hours') <> 'object' THEN
      RAISE EXCEPTION 'Opening hours must be a seven-day object.'
        USING ERRCODE = '22023';
    END IF;

    SELECT count(*)
    INTO v_hours_count
    FROM jsonb_object_keys(p_payload->'opening_hours');

    IF v_hours_count > 7 THEN
      RAISE EXCEPTION 'Opening hours must be a seven-day object.'
        USING ERRCODE = '22023';
    END IF;

    FOR v_hours_entry IN
      SELECT entry.key, entry.value
      FROM jsonb_each(p_payload->'opening_hours') AS entry
    LOOP
      IF v_hours_entry.key !~ '^[0-6]$'
         OR (
           jsonb_typeof(v_hours_entry.value) <> 'null'
           AND (
             jsonb_typeof(v_hours_entry.value) <> 'object'
             OR COALESCE(v_hours_entry.value->>'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
             OR COALESCE(v_hours_entry.value->>'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
             OR v_hours_entry.value->>'open' = v_hours_entry.value->>'close'
           )
         ) THEN
        RAISE EXCEPTION 'Opening hours contain an invalid day or time.'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM unnest(v_location_keys) AS requested(key)
    WHERE p_payload ? requested.key
  )
  INTO v_location_requested;

  IF v_location_requested THEN
    IF NOT (
      p_payload ? 'address'
      AND p_payload ? 'latitude'
      AND p_payload ? 'longitude'
      AND p_payload ? 'location_source'
      AND p_payload ? 'wilaya_id'
    )
       OR length(trim(COALESCE(p_payload->>'address', ''))) < 5
       OR NOT public.kiyo_is_coordinate_in_algeria(
         (p_payload->>'latitude')::double precision,
         (p_payload->>'longitude')::double precision
       )
       OR COALESCE(p_payload->>'location_source', '') NOT IN ('gps', 'manual', 'search')
       OR (
         p_payload->>'location_source' = 'gps'
         AND COALESCE(NULLIF(p_payload->>'location_accuracy_m', '')::numeric, 999999) > 50
       )
       OR (
         NULLIF(p_payload->>'location_accuracy_m', '') IS NOT NULL
         AND (p_payload->>'location_accuracy_m')::numeric < 0
       )
       OR NOT EXISTS (
         SELECT 1
         FROM public.wilayas AS wilaya
         WHERE wilaya.id = (p_payload->>'wilaya_id')::smallint
       ) THEN
      RAISE EXCEPTION 'Confirm a valid precise restaurant location before saving.'
        USING ERRCODE = '22023';
    END IF;

    IF v_restaurant.status IN ('published', 'hidden', 'suspended')
       AND (
         v_restaurant.address IS DISTINCT FROM p_payload->>'address'
         OR v_restaurant.latitude IS DISTINCT FROM (p_payload->>'latitude')::double precision
         OR v_restaurant.longitude IS DISTINCT FROM (p_payload->>'longitude')::double precision
         OR v_restaurant.wilaya_id IS DISTINCT FROM (p_payload->>'wilaya_id')::smallint
       ) THEN
      RAISE EXCEPTION 'Published restaurant location changes require platform review.'
        USING ERRCODE = '55006';
    END IF;
  END IF;

  UPDATE public.restaurants AS restaurant
  SET name = CASE WHEN p_payload ? 'name' THEN trim(p_payload->>'name') ELSE restaurant.name END,
      description = CASE WHEN p_payload ? 'description' THEN NULLIF(trim(p_payload->>'description'), '') ELSE restaurant.description END,
      phone = CASE WHEN p_payload ? 'phone' THEN trim(p_payload->>'phone') ELSE restaurant.phone END,
      cuisine = CASE
        WHEN p_payload ? 'cuisine'
          THEN ARRAY(
            SELECT trim(cuisine_value.value)
            FROM jsonb_array_elements_text(p_payload->'cuisine') AS cuisine_value(value)
          )
        ELSE restaurant.cuisine
      END,
      image_url = CASE WHEN p_payload ? 'image_url' THEN NULLIF(trim(p_payload->>'image_url'), '') ELSE restaurant.image_url END,
      opening_hours = CASE WHEN p_payload ? 'opening_hours' THEN p_payload->'opening_hours' ELSE restaurant.opening_hours END,
      estimated_delivery_min = CASE
        WHEN p_payload ? 'estimated_delivery_min' THEN (p_payload->>'estimated_delivery_min')::integer
        ELSE restaurant.estimated_delivery_min
      END,
      address = CASE WHEN v_location_requested THEN trim(p_payload->>'address') ELSE restaurant.address END,
      latitude = CASE WHEN v_location_requested THEN (p_payload->>'latitude')::double precision ELSE restaurant.latitude END,
      longitude = CASE WHEN v_location_requested THEN (p_payload->>'longitude')::double precision ELSE restaurant.longitude END,
      location_accuracy_m = CASE
        WHEN v_location_requested THEN NULLIF(p_payload->>'location_accuracy_m', '')::numeric
        ELSE restaurant.location_accuracy_m
      END,
      location_verified = CASE WHEN v_location_requested THEN true ELSE restaurant.location_verified END,
      location_source = CASE WHEN v_location_requested THEN p_payload->>'location_source' ELSE restaurant.location_source END,
      location_updated_at = CASE WHEN v_location_requested THEN now() ELSE restaurant.location_updated_at END,
      place_id = CASE WHEN v_location_requested THEN NULLIF(p_payload->>'place_id', '') ELSE restaurant.place_id END,
      street = CASE WHEN v_location_requested THEN NULLIF(p_payload->>'street', '') ELSE restaurant.street END,
      neighborhood = CASE WHEN v_location_requested THEN NULLIF(p_payload->>'neighborhood', '') ELSE restaurant.neighborhood END,
      commune = CASE WHEN v_location_requested THEN NULLIF(p_payload->>'commune', '') ELSE restaurant.commune END,
      city = CASE WHEN v_location_requested THEN NULLIF(p_payload->>'city', '') ELSE restaurant.city END,
      province = CASE WHEN v_location_requested THEN NULLIF(p_payload->>'province', '') ELSE restaurant.province END,
      postal_code = CASE WHEN v_location_requested THEN NULLIF(p_payload->>'postal_code', '') ELSE restaurant.postal_code END,
      country = CASE WHEN v_location_requested THEN COALESCE(NULLIF(p_payload->>'country', ''), 'Algeria') ELSE restaurant.country END,
      wilaya_id = CASE WHEN v_location_requested THEN (p_payload->>'wilaya_id')::smallint ELSE restaurant.wilaya_id END,
      updated_at = now()
  WHERE restaurant.id = p_restaurant_id
  RETURNING restaurant.*
  INTO v_result;

  SELECT array_agg(changed.key ORDER BY changed.key)
  INTO v_changed_fields
  FROM jsonb_each(to_jsonb(v_result) - 'updated_at') AS changed(key, value)
  WHERE to_jsonb(v_restaurant)->changed.key IS DISTINCT FROM changed.value;

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
      'change', 'profile_settings',
      'changed_fields', COALESCE(to_jsonb(v_changed_fields), '[]'::jsonb),
      'location_changed', v_location_requested
    )
  );

  RETURN to_jsonb(v_result);
END
$function$;

COMMENT ON FUNCTION public.update_restaurant_profile_settings(uuid, uuid, jsonb, timestamptz) IS
  'Trusted, validated and audited restaurant profile, schedule and onboarding-location update.';

REVOKE ALL ON FUNCTION public.update_restaurant_profile_settings(uuid, uuid, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_restaurant_profile_settings(uuid, uuid, jsonb, timestamptz)
  TO service_role;

COMMIT;
