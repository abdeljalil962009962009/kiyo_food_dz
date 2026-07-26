-- Rollback for migration 0069.
-- Deploy application code that no longer calls the safe projection first.
-- Versioned overrides created by 0069 are intentionally retained: deleting
-- financial configuration history would be destructive and unauditable.

REVOKE ALL ON FUNCTION public.get_restaurant_effective_delivery_rules(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.get_restaurant_effective_delivery_rules(uuid, uuid);

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
  v_delivery jsonb := '{}'::jsonb;
  v_commission jsonb := '{}'::jsonb;
  v_taxes jsonb := '{}'::jsonb;
  v_wilaya public.marketplace_rule_overrides%ROWTYPE;
  v_restaurant_override public.marketplace_rule_overrides%ROWTYPE;
  v_term public.restaurant_commercial_terms%ROWTYPE;
  v_global_updated timestamptz;
BEGIN
  SELECT restaurant.*
  INTO v_restaurant
  FROM public.restaurants AS restaurant
  WHERE restaurant.id = p_restaurant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Restaurant not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT setting.value, setting.updated_at
  INTO v_delivery, v_global_updated
  FROM public.platform_settings AS setting
  WHERE setting.key = 'delivery';
  SELECT setting.value
  INTO v_commission
  FROM public.platform_settings AS setting
  WHERE setting.key = 'commission';
  SELECT setting.value
  INTO v_taxes
  FROM public.platform_settings AS setting
  WHERE setting.key = 'taxes_fees';

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

  v_delivery := COALESCE(v_delivery, '{}'::jsonb)
    || COALESCE(v_wilaya.values->'delivery', '{}'::jsonb)
    || COALESCE(v_restaurant_override.values->'delivery', '{}'::jsonb);
  v_commission := COALESCE(v_commission, '{}'::jsonb)
    || COALESCE(v_wilaya.values->'commission', '{}'::jsonb)
    || COALESCE(v_restaurant_override.values->'commission', '{}'::jsonb);
  v_taxes := COALESCE(v_taxes, '{}'::jsonb)
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

  v_delivery := v_delivery || jsonb_build_object(
    'max_delivery_km', COALESCE(
      (v_restaurant_override.values->'delivery'->>'max_delivery_km')::numeric,
      v_restaurant.max_delivery_km,
      (v_wilaya.values->'delivery'->>'max_delivery_km')::numeric,
      (v_delivery->>'default_max_delivery_km')::numeric,
      10
    ),
    'minimum_order', COALESCE(
      (v_restaurant_override.values->'delivery'->>'minimum_order')::numeric,
      v_restaurant.min_order_amount,
      (v_wilaya.values->'delivery'->>'minimum_order')::numeric,
      0
    )
  );

  RETURN jsonb_build_object(
    'delivery', v_delivery,
    'commission', v_commission || jsonb_build_object(
      'commercial_term_id', v_term.id,
      'commercial_term_version', v_term.version,
      'commission_base', v_term.commission_base,
      'food_commission_rate', v_term.food_commission_rate,
      'delivery_share_rate', v_term.delivery_share_rate
    ),
    'taxes_fees', v_taxes,
    'sources', jsonb_build_object(
      'global_updated_at', v_global_updated,
      'wilaya_override_id', v_wilaya.id,
      'wilaya_override_version', v_wilaya.version,
      'restaurant_override_id', v_restaurant_override.id,
      'restaurant_override_version', v_restaurant_override.version,
      'commercial_term_id', v_term.id,
      'commercial_term_version', v_term.version
    )
  );
END
$function$;

REVOKE ALL ON FUNCTION public.resolve_marketplace_rules(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_marketplace_rules(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.resolve_marketplace_delivery_rules(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.resolve_marketplace_delivery_rules(uuid);

DROP TRIGGER IF EXISTS trg_validate_marketplace_delivery_override
  ON public.marketplace_rule_overrides;
DROP FUNCTION IF EXISTS public.validate_marketplace_delivery_override();

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_delivery_limits;

-- Versioned 0069 migration rows remain as immutable rule history. They can be
-- superseded safely through the Control Center after rollback.
