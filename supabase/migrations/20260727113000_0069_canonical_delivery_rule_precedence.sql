-- Canonical delivery-rule precedence and safe effective-rule visibility.
-- Precedence is restaurant override -> Wilaya override -> global default.
-- Existing legacy restaurant values are promoted to versioned overrides first,
-- so this migration does not silently change a restaurant's current terms.

BEGIN;

DO $promote_legacy_delivery_rules$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_current public.marketplace_rule_overrides%ROWTYPE;
  v_wilaya public.marketplace_rule_overrides%ROWTYPE;
  v_global jsonb;
  v_additions jsonb;
  v_next_version integer;
  v_new_override public.marketplace_rule_overrides%ROWTYPE;
  v_inherited_max numeric;
  v_inherited_minimum numeric;
BEGIN
  SELECT COALESCE(setting.value, '{}'::jsonb)
  INTO v_global
  FROM public.platform_settings AS setting
  WHERE setting.key = 'delivery';

  v_global := COALESCE(v_global, '{}'::jsonb);

  FOR v_restaurant IN
    SELECT restaurant.*
    FROM public.restaurants AS restaurant
    ORDER BY restaurant.id
  LOOP
    v_current := NULL;
    v_wilaya := NULL;

    IF v_restaurant.wilaya_id IS NOT NULL THEN
      SELECT rule.*
      INTO v_wilaya
      FROM public.marketplace_rule_overrides AS rule
      WHERE rule.scope_type = 'wilaya'
        AND rule.scope_id = v_restaurant.wilaya_id::text
        AND rule.status IN ('active', 'scheduled')
        AND rule.effective_at <= now()
        AND (rule.expires_at IS NULL OR rule.expires_at > now())
      ORDER BY rule.version DESC
      LIMIT 1;
    END IF;

    SELECT rule.*
    INTO v_current
    FROM public.marketplace_rule_overrides AS rule
    WHERE rule.scope_type = 'restaurant'
      AND rule.scope_id = v_restaurant.id::text
      AND rule.status IN ('active', 'scheduled')
      AND (rule.expires_at IS NULL OR rule.expires_at > now())
    ORDER BY rule.version DESC
    LIMIT 1
    FOR UPDATE;

    -- A future rule is an explicit owner decision. Do not rewrite it or create
    -- a conflicting "current" row merely to preserve the legacy fallback.
    IF v_current.id IS NOT NULL AND v_current.effective_at > now() THEN
      CONTINUE;
    END IF;

    v_inherited_max := COALESCE(
      (v_wilaya.values->'delivery'->>'max_delivery_km')::numeric,
      (v_global->>'default_max_delivery_km')::numeric,
      10
    );
    v_inherited_minimum := COALESCE(
      (v_wilaya.values->'delivery'->>'minimum_order')::numeric,
      (v_global->>'minimum_order')::numeric,
      0
    );
    v_additions := '{}'::jsonb;

    IF NOT (COALESCE(v_current.values->'delivery', '{}'::jsonb) ? 'max_delivery_km')
       AND v_restaurant.max_delivery_km IS NOT NULL
       AND v_restaurant.max_delivery_km IS DISTINCT FROM v_inherited_max THEN
      v_additions := v_additions || jsonb_build_object(
        'max_delivery_km',
        v_restaurant.max_delivery_km
      );
    END IF;

    IF NOT (COALESCE(v_current.values->'delivery', '{}'::jsonb) ? 'minimum_order')
       AND v_restaurant.min_order_amount IS NOT NULL
       AND v_restaurant.min_order_amount IS DISTINCT FROM v_inherited_minimum THEN
      v_additions := v_additions || jsonb_build_object(
        'minimum_order',
        v_restaurant.min_order_amount
      );
    END IF;

    IF v_additions = '{}'::jsonb THEN
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended('restaurant:' || v_restaurant.id::text, 0)
    );

    SELECT COALESCE(max(rule.version), 0) + 1
    INTO v_next_version
    FROM public.marketplace_rule_overrides AS rule
    WHERE rule.scope_type = 'restaurant'
      AND rule.scope_id = v_restaurant.id::text;

    IF v_current.id IS NOT NULL THEN
      UPDATE public.marketplace_rule_overrides AS rule
      SET status = 'replaced',
          expires_at = now(),
          updated_at = now()
      WHERE rule.id = v_current.id;
    END IF;

    INSERT INTO public.marketplace_rule_overrides (
      scope_type,
      scope_id,
      version,
      status,
      values,
      effective_at,
      created_by,
      reason
    )
    VALUES (
      'restaurant',
      v_restaurant.id::text,
      v_next_version,
      'active',
      COALESCE(v_current.values, '{}'::jsonb)
        || jsonb_build_object(
          'delivery',
          COALESCE(v_current.values->'delivery', '{}'::jsonb) || v_additions
        ),
      now(),
      NULL,
      '[0069] Promoted legacy restaurant delivery settings into the canonical override hierarchy.'
    )
    RETURNING *
    INTO v_new_override;

    INSERT INTO public.audit_logs (
      actor_id,
      action,
      target_type,
      target_id,
      metadata
    )
    VALUES (
      NULL,
      'platform_setting_updated',
      'marketplace_rule_override',
      v_new_override.id,
      jsonb_build_object(
        'change', 'legacy_delivery_rule_promoted',
        'restaurant_id', v_restaurant.id,
        'previous_override_id', v_current.id,
        'new_version', v_new_override.version,
        'promoted_values', v_additions
      )
    );
  END LOOP;
END
$promote_legacy_delivery_rules$;

CREATE OR REPLACE FUNCTION public.validate_marketplace_delivery_override()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_delivery jsonb := COALESCE(NEW.values->'delivery', '{}'::jsonb);
  v_max_delivery_km numeric;
  v_minimum_order numeric;
BEGIN
  IF v_delivery ? 'max_delivery_km' THEN
    v_max_delivery_km := (v_delivery->>'max_delivery_km')::numeric;
    IF v_max_delivery_km <= 0 OR v_max_delivery_km > 100 THEN
      RAISE EXCEPTION 'Maximum delivery distance must be between 0 and 100 kilometres.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_delivery ? 'minimum_order' THEN
    v_minimum_order := (v_delivery->>'minimum_order')::numeric;
    IF v_minimum_order < 0 THEN
      RAISE EXCEPTION 'Minimum order cannot be negative.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_validate_marketplace_delivery_override
  ON public.marketplace_rule_overrides;
CREATE TRIGGER trg_validate_marketplace_delivery_override
  BEFORE INSERT OR UPDATE OF values
  ON public.marketplace_rule_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_marketplace_delivery_override();

REVOKE ALL ON FUNCTION public.validate_marketplace_delivery_override()
  FROM PUBLIC, anon, authenticated;

DO $delivery_setting_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraint_row
    WHERE constraint_row.conrelid = 'public.platform_settings'::regclass
      AND constraint_row.conname = 'platform_settings_delivery_limits'
  ) THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT platform_settings_delivery_limits
      CHECK (
        key <> 'delivery'
        OR (
          COALESCE((value->>'default_max_delivery_km')::numeric, 10) > 0
          AND COALESCE((value->>'default_max_delivery_km')::numeric, 10) <= 100
          AND COALESCE((value->>'minimum_order')::numeric, 0) >= 0
        )
      )
      NOT VALID;
  END IF;
END
$delivery_setting_constraint$;

ALTER TABLE public.platform_settings
  VALIDATE CONSTRAINT platform_settings_delivery_limits;

CREATE OR REPLACE FUNCTION public.resolve_marketplace_delivery_rules(
  p_restaurant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_global jsonb := '{}'::jsonb;
  v_wilaya public.marketplace_rule_overrides%ROWTYPE;
  v_restaurant_override public.marketplace_rule_overrides%ROWTYPE;
  v_delivery jsonb;
  v_max_delivery_km numeric;
  v_minimum_order numeric;
  v_max_source text;
  v_minimum_source text;
  v_global_updated_at timestamptz;
BEGIN
  SELECT restaurant.*
  INTO v_restaurant
  FROM public.restaurants AS restaurant
  WHERE restaurant.id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(setting.value, '{}'::jsonb), setting.updated_at
  INTO v_global, v_global_updated_at
  FROM public.platform_settings AS setting
  WHERE setting.key = 'delivery';

  v_global := COALESCE(v_global, '{}'::jsonb);

  IF v_restaurant.wilaya_id IS NOT NULL THEN
    SELECT rule.*
    INTO v_wilaya
    FROM public.marketplace_rule_overrides AS rule
    WHERE rule.scope_type = 'wilaya'
      AND rule.scope_id = v_restaurant.wilaya_id::text
      AND rule.status IN ('active', 'scheduled')
      AND rule.effective_at <= now()
      AND (rule.expires_at IS NULL OR rule.expires_at > now())
    ORDER BY rule.version DESC
    LIMIT 1;
  END IF;

  SELECT rule.*
  INTO v_restaurant_override
  FROM public.marketplace_rule_overrides AS rule
  WHERE rule.scope_type = 'restaurant'
    AND rule.scope_id = p_restaurant_id::text
    AND rule.status IN ('active', 'scheduled')
    AND rule.effective_at <= now()
    AND (rule.expires_at IS NULL OR rule.expires_at > now())
  ORDER BY rule.version DESC
  LIMIT 1;

  v_delivery := v_global
    || COALESCE(v_wilaya.values->'delivery', '{}'::jsonb)
    || COALESCE(v_restaurant_override.values->'delivery', '{}'::jsonb);

  v_max_delivery_km := COALESCE(
    (v_restaurant_override.values->'delivery'->>'max_delivery_km')::numeric,
    (v_wilaya.values->'delivery'->>'max_delivery_km')::numeric,
    (v_global->>'default_max_delivery_km')::numeric,
    10
  );
  v_minimum_order := COALESCE(
    (v_restaurant_override.values->'delivery'->>'minimum_order')::numeric,
    (v_wilaya.values->'delivery'->>'minimum_order')::numeric,
    (v_global->>'minimum_order')::numeric,
    0
  );

  IF v_max_delivery_km <= 0 OR v_max_delivery_km > 100
     OR v_minimum_order < 0 THEN
    RAISE EXCEPTION 'Effective delivery rules are invalid.'
      USING ERRCODE = '22023';
  END IF;

  v_max_source := CASE
    WHEN COALESCE(v_restaurant_override.values->'delivery', '{}'::jsonb) ? 'max_delivery_km'
      THEN 'restaurant'
    WHEN COALESCE(v_wilaya.values->'delivery', '{}'::jsonb) ? 'max_delivery_km'
      THEN 'wilaya'
    ELSE 'global'
  END;
  v_minimum_source := CASE
    WHEN COALESCE(v_restaurant_override.values->'delivery', '{}'::jsonb) ? 'minimum_order'
      THEN 'restaurant'
    WHEN COALESCE(v_wilaya.values->'delivery', '{}'::jsonb) ? 'minimum_order'
      THEN 'wilaya'
    ELSE 'global'
  END;

  RETURN jsonb_build_object(
    'delivery',
    v_delivery || jsonb_build_object(
      'max_delivery_km', v_max_delivery_km,
      'minimum_order', v_minimum_order
    ),
    'sources',
    jsonb_build_object(
      'max_delivery_km', v_max_source,
      'minimum_order', v_minimum_source,
      'global_updated_at', v_global_updated_at,
      'wilaya_override_id', v_wilaya.id,
      'wilaya_override_version', v_wilaya.version,
      'restaurant_override_id', v_restaurant_override.id,
      'restaurant_override_version', v_restaurant_override.version
    )
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.resolve_marketplace_rules(
  p_restaurant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_delivery_result jsonb;
  v_commission jsonb := '{}'::jsonb;
  v_taxes jsonb := '{}'::jsonb;
  v_wilaya public.marketplace_rule_overrides%ROWTYPE;
  v_restaurant_override public.marketplace_rule_overrides%ROWTYPE;
  v_term public.restaurant_commercial_terms%ROWTYPE;
BEGIN
  SELECT restaurant.*
  INTO v_restaurant
  FROM public.restaurants AS restaurant
  WHERE restaurant.id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002';
  END IF;

  v_delivery_result := public.resolve_marketplace_delivery_rules(p_restaurant_id);

  SELECT COALESCE(setting.value, '{}'::jsonb)
  INTO v_commission
  FROM public.platform_settings AS setting
  WHERE setting.key = 'commission';

  SELECT COALESCE(setting.value, '{}'::jsonb)
  INTO v_taxes
  FROM public.platform_settings AS setting
  WHERE setting.key = 'taxes_fees';

  v_commission := COALESCE(v_commission, '{}'::jsonb);
  v_taxes := COALESCE(v_taxes, '{}'::jsonb);

  IF v_restaurant.wilaya_id IS NOT NULL THEN
    SELECT rule.*
    INTO v_wilaya
    FROM public.marketplace_rule_overrides AS rule
    WHERE rule.scope_type = 'wilaya'
      AND rule.scope_id = v_restaurant.wilaya_id::text
      AND rule.status IN ('active', 'scheduled')
      AND rule.effective_at <= now()
      AND (rule.expires_at IS NULL OR rule.expires_at > now())
    ORDER BY rule.version DESC
    LIMIT 1;
  END IF;

  SELECT rule.*
  INTO v_restaurant_override
  FROM public.marketplace_rule_overrides AS rule
  WHERE rule.scope_type = 'restaurant'
    AND rule.scope_id = p_restaurant_id::text
    AND rule.status IN ('active', 'scheduled')
    AND rule.effective_at <= now()
    AND (rule.expires_at IS NULL OR rule.expires_at > now())
  ORDER BY rule.version DESC
  LIMIT 1;

  v_commission := v_commission
    || COALESCE(v_wilaya.values->'commission', '{}'::jsonb)
    || COALESCE(v_restaurant_override.values->'commission', '{}'::jsonb);
  v_taxes := v_taxes
    || COALESCE(v_wilaya.values->'taxes_fees', '{}'::jsonb)
    || COALESCE(v_restaurant_override.values->'taxes_fees', '{}'::jsonb);

  SELECT term.*
  INTO v_term
  FROM public.restaurant_commercial_terms AS term
  WHERE term.restaurant_id = p_restaurant_id
    AND term.status IN ('active', 'scheduled')
    AND term.effective_at <= now()
    AND (term.expires_at IS NULL OR term.expires_at > now())
  ORDER BY term.version DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active approved commercial agreement exists for this restaurant.'
      USING ERRCODE = '55006';
  END IF;

  RETURN jsonb_build_object(
    'delivery', v_delivery_result->'delivery',
    'commission', v_commission || jsonb_build_object(
      'commercial_term_id', v_term.id,
      'commercial_term_version', v_term.version,
      'commission_base', v_term.commission_base,
      'food_commission_rate', v_term.food_commission_rate,
      'delivery_share_rate', v_term.delivery_share_rate
    ),
    'taxes_fees', v_taxes,
    'sources', COALESCE(v_delivery_result->'sources', '{}'::jsonb)
      || jsonb_build_object(
        'commercial_term_id', v_term.id,
        'commercial_term_version', v_term.version
      )
  );
END
$function$;

CREATE OR REPLACE FUNCTION public.get_restaurant_effective_delivery_rules(
  p_actor_id uuid,
  p_restaurant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_actor_id IS NULL OR p_restaurant_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.profiles AS profile
       WHERE profile.id = p_actor_id
         AND NOT COALESCE(profile.is_suspended, false)
     ) THEN
    RAISE EXCEPTION 'An active account and restaurant are required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT restaurant.*
  INTO v_restaurant
  FROM public.restaurants AS restaurant
  WHERE restaurant.id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_restaurant.status <> 'published'
     AND NOT EXISTS (
       SELECT 1
       FROM public.profiles AS profile
       WHERE profile.id = p_actor_id
         AND profile.role = 'super_admin'
     )
     AND v_restaurant.owner_id IS DISTINCT FROM p_actor_id
     AND NOT EXISTS (
       SELECT 1
       FROM public.restaurant_memberships AS membership
       WHERE membership.restaurant_id = p_restaurant_id
         AND membership.user_id = p_actor_id
         AND membership.status = 'active'
         AND membership.membership_role IN ('owner', 'manager')
     ) THEN
    RAISE EXCEPTION 'This restaurant is not available.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.resolve_marketplace_delivery_rules(p_restaurant_id);
END
$function$;

COMMENT ON FUNCTION public.resolve_marketplace_delivery_rules(uuid) IS
  'Internal canonical delivery-rule resolver: restaurant override, then Wilaya, then global.';
COMMENT ON FUNCTION public.get_restaurant_effective_delivery_rules(uuid, uuid) IS
  'Trusted safe delivery-rule projection for checkout and authorized restaurant workspaces.';

REVOKE ALL ON FUNCTION public.resolve_marketplace_delivery_rules(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_marketplace_delivery_rules(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.resolve_marketplace_rules(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_marketplace_rules(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_restaurant_effective_delivery_rules(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_restaurant_effective_delivery_rules(uuid, uuid)
  TO service_role;

COMMIT;
