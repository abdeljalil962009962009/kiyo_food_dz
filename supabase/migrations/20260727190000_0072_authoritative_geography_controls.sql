-- Make Control Center geography changes idempotent, audited and server-authoritative.
-- Delivery-zone fee columns are retained for compatibility, but checkout pricing
-- continues to use the canonical versioned marketplace rule resolver.

BEGIN;

ALTER TABLE public.delivery_zones
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.wilayas
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS zones_modify ON public.delivery_zones;
DROP POLICY IF EXISTS wilayas_all_admin ON public.wilayas;

COMMENT ON TABLE public.delivery_zones IS
  'Operational service-area records. Fee columns are compatibility snapshots only; authoritative checkout pricing comes from versioned marketplace rules.';

CREATE OR REPLACE FUNCTION public.manage_geography_control(
  p_actor_id uuid,
  p_request_id uuid,
  p_action text,
  p_args jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_existing_request public.owner_action_requests%ROWTYPE;
  v_zone public.delivery_zones%ROWTYPE;
  v_wilaya public.wilayas%ROWTYPE;
  v_name text;
  v_wilaya_id smallint;
  v_zone_id uuid;
  v_active boolean;
  v_expected_updated_at timestamptz;
  v_global jsonb := '{}'::jsonb;
  v_override jsonb := '{}'::jsonb;
  v_result jsonb;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.' USING ERRCODE = '42501';
  END IF;
  IF p_actor_id IS NULL
     OR p_request_id IS NULL
     OR p_action NOT IN ('create_delivery_zone', 'set_delivery_zone_active', 'set_wilaya_active')
     OR jsonb_typeof(COALESCE(p_args, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid geography control request.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = p_actor_id
      AND profile.role = 'super_admin'
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'Only an active platform owner can change geography controls.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.owner_action_requests (actor_id, request_id, action, args)
  VALUES (p_actor_id, p_request_id, p_action, COALESCE(p_args, '{}'::jsonb))
  ON CONFLICT (actor_id, request_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT request.*
    INTO v_existing_request
    FROM public.owner_action_requests AS request
    WHERE request.actor_id = p_actor_id
      AND request.request_id = p_request_id;

    IF v_existing_request.action IS DISTINCT FROM p_action
       OR v_existing_request.args IS DISTINCT FROM COALESCE(p_args, '{}'::jsonb) THEN
      RAISE EXCEPTION 'Idempotency key was reused for a different action.'
        USING ERRCODE = 'PT409';
    END IF;
    IF v_existing_request.completed_at IS NULL THEN
      RAISE EXCEPTION 'This geography action is already being processed.'
        USING ERRCODE = 'PT409';
    END IF;
    RETURN v_existing_request.result;
  END IF;

  CASE p_action
    WHEN 'create_delivery_zone' THEN
      v_name := trim(COALESCE(p_args->>'p_name', ''));
      v_wilaya_id := NULLIF(p_args->>'p_wilaya_id', '')::smallint;

      IF v_wilaya_id IS NULL OR length(v_name) < 2 OR length(v_name) > 120 THEN
        RAISE EXCEPTION 'Select a Wilaya and enter a zone name between 2 and 120 characters.'
          USING ERRCODE = '22023';
      END IF;

      SELECT wilaya.*
      INTO v_wilaya
      FROM public.wilayas AS wilaya
      WHERE wilaya.id = v_wilaya_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'The selected Wilaya does not exist.' USING ERRCODE = 'P0002';
      END IF;

      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
          'delivery-zone:' || v_wilaya_id::text || ':' || lower(v_name),
          0
        )
      );
      IF EXISTS (
        SELECT 1
        FROM public.delivery_zones AS zone
        WHERE zone.wilaya_id = v_wilaya_id
          AND lower(trim(zone.name)) = lower(v_name)
      ) THEN
        RAISE EXCEPTION 'A service zone with this name already exists in the selected Wilaya.'
          USING ERRCODE = '23505';
      END IF;

      SELECT COALESCE(setting.value, '{}'::jsonb)
      INTO v_global
      FROM public.platform_settings AS setting
      WHERE setting.key = 'delivery';

      SELECT COALESCE(rule.values->'delivery', '{}'::jsonb)
      INTO v_override
      FROM public.marketplace_rule_overrides AS rule
      WHERE rule.scope_type = 'wilaya'
        AND rule.scope_id = v_wilaya_id::text
        AND rule.status = 'active'
        AND rule.effective_at <= now()
      ORDER BY rule.version DESC
      LIMIT 1;

      INSERT INTO public.delivery_zones (
        wilaya_id,
        name,
        base_fee,
        per_km_fee,
        min_fee,
        is_active,
        updated_at,
        updated_by
      )
      VALUES (
        v_wilaya_id,
        v_name,
        0,
        COALESCE((v_override->>'price_per_km')::numeric, (v_global->>'price_per_km')::numeric, 63),
        COALESCE((v_override->>'min_fee')::numeric, (v_global->>'min_fee')::numeric, 100),
        true,
        now(),
        p_actor_id
      )
      RETURNING * INTO v_zone;

      v_result := to_jsonb(v_zone);

    WHEN 'set_delivery_zone_active' THEN
      v_zone_id := NULLIF(p_args->>'p_zone_id', '')::uuid;
      v_active := NULLIF(p_args->>'p_active', '')::boolean;
      v_expected_updated_at := NULLIF(p_args->>'p_expected_updated_at', '')::timestamptz;
      IF v_zone_id IS NULL OR v_active IS NULL OR v_expected_updated_at IS NULL THEN
        RAISE EXCEPTION 'Zone status request is incomplete.' USING ERRCODE = '22023';
      END IF;

      SELECT zone.*
      INTO v_zone
      FROM public.delivery_zones AS zone
      WHERE zone.id = v_zone_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'The delivery zone was not found.' USING ERRCODE = 'P0002';
      END IF;
      IF v_zone.updated_at IS DISTINCT FROM v_expected_updated_at THEN
        RAISE EXCEPTION 'This service zone changed in another session. Refresh before trying again.'
          USING ERRCODE = '40001';
      END IF;

      UPDATE public.delivery_zones AS zone
      SET is_active = v_active,
          updated_at = now(),
          updated_by = p_actor_id
      WHERE zone.id = v_zone.id
      RETURNING zone.* INTO v_zone;
      v_result := to_jsonb(v_zone);

    WHEN 'set_wilaya_active' THEN
      v_wilaya_id := NULLIF(p_args->>'p_wilaya_id', '')::smallint;
      v_active := NULLIF(p_args->>'p_active', '')::boolean;
      v_expected_updated_at := NULLIF(p_args->>'p_expected_updated_at', '')::timestamptz;
      IF v_wilaya_id IS NULL OR v_active IS NULL OR v_expected_updated_at IS NULL THEN
        RAISE EXCEPTION 'Wilaya status request is incomplete.' USING ERRCODE = '22023';
      END IF;

      SELECT wilaya.*
      INTO v_wilaya
      FROM public.wilayas AS wilaya
      WHERE wilaya.id = v_wilaya_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'The Wilaya was not found.' USING ERRCODE = 'P0002';
      END IF;
      IF v_wilaya.updated_at IS DISTINCT FROM v_expected_updated_at THEN
        RAISE EXCEPTION 'This Wilaya changed in another session. Refresh before trying again.'
          USING ERRCODE = '40001';
      END IF;

      UPDATE public.wilayas AS wilaya
      SET is_active = v_active,
          updated_at = now(),
          updated_by = p_actor_id
      WHERE wilaya.id = v_wilaya.id
      RETURNING wilaya.* INTO v_wilaya;
      v_result := to_jsonb(v_wilaya);
  END CASE;

  INSERT INTO public.audit_logs (actor_id, action, target_type, target_id, metadata)
  VALUES (
    p_actor_id,
    'platform_setting_updated',
    CASE WHEN p_action = 'set_wilaya_active' THEN 'wilaya' ELSE 'delivery_zone' END,
    CASE WHEN p_action = 'set_wilaya_active' THEN NULL ELSE v_zone.id END,
    jsonb_build_object(
      'control_action', p_action,
      'request_id', p_request_id,
      'wilaya_id', COALESCE(v_wilaya.id, v_zone.wilaya_id),
      'result', v_result
    )
  );

  UPDATE public.owner_action_requests AS request
  SET result = v_result,
      completed_at = now()
  WHERE request.actor_id = p_actor_id
    AND request.request_id = p_request_id;

  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION public.manage_geography_control(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_geography_control(uuid, uuid, text, jsonb)
  TO service_role;

COMMIT;
