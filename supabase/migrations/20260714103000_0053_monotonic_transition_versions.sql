BEGIN;

-- now() is stable for an entire transaction, so it cannot be used as an
-- optimistic-concurrency token when more than one transition can occur in the
-- same transaction. Keep updated_at strictly increasing for every transition.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at := CASE
    WHEN OLD.updated_at IS NULL THEN clock_timestamp()
    ELSE GREATEST(clock_timestamp(), OLD.updated_at + interval '1 microsecond')
  END;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id uuid,
  p_target_status public.order_status,
  p_reason text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_old_status public.order_status;
  v_allowed boolean;
  v_actor_role text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002'; END IF;
  IF NOT (
    public.is_super_admin()
    OR public.can_manage_restaurant(v_order.restaurant_id)
    OR (v_order.customer_id = auth.uid() AND v_order.status = 'pending' AND p_target_status = 'cancelled')
    OR EXISTS (
      SELECT 1 FROM public.deliveries delivery
      JOIN public.drivers driver ON driver.id = delivery.driver_id
      WHERE delivery.order_id = v_order.id AND driver.user_id = auth.uid()
        AND delivery.status IN ('picked_up','en_route','arrived','delivered','failed')
        AND p_target_status IN ('delivered','failed_delivery')
    )
  ) THEN
    RAISE EXCEPTION 'You cannot change this order.' USING ERRCODE = '42501';
  END IF;
  IF p_expected_updated_at IS NOT NULL AND v_order.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'This order changed in another session. Reload before acting.' USING ERRCODE = '40001';
  END IF;

  v_allowed :=
    (v_order.status = 'pending' AND p_target_status IN ('accepted','cancelled'))
    OR (v_order.status = 'accepted' AND p_target_status IN ('preparing','cancelled'))
    OR (v_order.status = 'preparing' AND p_target_status IN ('out_for_delivery','cancelled'))
    OR (v_order.status = 'out_for_delivery' AND p_target_status IN ('delivered','failed_delivery','cancelled'))
    OR (v_order.status IN ('delivered','cancelled','failed_delivery') AND p_target_status = 'refunded');
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid order transition: % -> %', v_order.status, p_target_status USING ERRCODE = '22023';
  END IF;
  IF p_target_status IN ('cancelled','failed_delivery','refunded')
     AND length(trim(COALESCE(p_reason,''))) < 3 THEN
    RAISE EXCEPTION 'A clear reason is required for this order transition.' USING ERRCODE = '22023';
  END IF;

  v_actor_role := CASE
    WHEN public.is_super_admin() THEN 'super_admin'
    WHEN v_order.customer_id = auth.uid() THEN 'customer'
    WHEN EXISTS (
      SELECT 1 FROM public.deliveries delivery
      JOIN public.drivers driver ON driver.id = delivery.driver_id
      WHERE delivery.order_id = v_order.id AND driver.user_id = auth.uid()
    ) THEN 'driver'
    ELSE 'restaurant'
  END;
  v_old_status := v_order.status;
  PERFORM set_config('kiyo.domain_order_transition', 'allowed', true);
  UPDATE public.orders
  SET status = p_target_status,
      updated_at = CASE
        WHEN v_order.updated_at IS NULL THEN clock_timestamp()
        ELSE GREATEST(clock_timestamp(), v_order.updated_at + interval '1 microsecond')
      END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.order_status_transitions (
    order_id, from_status, to_status, actor_id, actor_role, reason
  ) VALUES (
    p_order_id, v_old_status,
    p_target_status, auth.uid(), v_actor_role, NULLIF(trim(p_reason), '')
  );

  UPDATE public.financial_ledger
  SET accounting_status = CASE
        WHEN p_target_status = 'delivered' THEN 'earned'
        WHEN p_target_status IN ('cancelled','failed_delivery','refunded')
          THEN CASE WHEN accounting_status = 'settled' THEN 'disputed' ELSE 'void' END
        ELSE accounting_status
      END,
      metadata = metadata || jsonb_build_object(
        'last_order_status', p_target_status, 'last_status_reason', p_reason,
        'last_status_changed_at', now()
      )
  WHERE order_id = p_order_id;
  RETURN v_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_delivery_status(
  p_delivery_id uuid,
  p_target_status text,
  p_reason text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS public.deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_delivery public.deliveries%ROWTYPE;
  v_driver_user_id uuid;
  v_allowed boolean;
BEGIN
  SELECT delivery.* INTO v_delivery
  FROM public.deliveries delivery
  WHERE delivery.id = p_delivery_id
  FOR UPDATE OF delivery;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found.' USING ERRCODE = 'P0002'; END IF;

  SELECT driver.user_id INTO v_driver_user_id
  FROM public.drivers driver
  WHERE driver.id = v_delivery.driver_id;

  IF NOT public.is_super_admin() AND v_driver_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'This delivery is not assigned to you.' USING ERRCODE = '42501';
  END IF;
  IF p_expected_updated_at IS NOT NULL AND v_delivery.updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'This delivery changed in another session. Reload before acting.' USING ERRCODE = '40001';
  END IF;
  v_allowed :=
    (v_delivery.status = 'assigned' AND p_target_status IN ('driver_accepted','driver_declined'))
    OR (v_delivery.status = 'driver_accepted' AND p_target_status = 'picking_up')
    OR (v_delivery.status = 'picking_up' AND p_target_status = 'picked_up')
    OR (v_delivery.status = 'picked_up' AND p_target_status = 'en_route')
    OR (v_delivery.status = 'en_route' AND p_target_status = 'arrived')
    OR (v_delivery.status = 'arrived' AND p_target_status IN ('delivered','failed'));
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid delivery transition: % -> %', v_delivery.status, p_target_status USING ERRCODE = '22023';
  END IF;
  IF p_target_status = 'failed' AND length(trim(COALESCE(p_reason,''))) < 3 THEN
    RAISE EXCEPTION 'A delivery failure reason is required.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.deliveries
  SET status = p_target_status,
      pickup_at = CASE WHEN p_target_status = 'picking_up' THEN COALESCE(pickup_at, now()) ELSE pickup_at END,
      picked_up_at = CASE WHEN p_target_status = 'picked_up' THEN COALESCE(picked_up_at, now()) ELSE picked_up_at END,
      delivered_at = CASE WHEN p_target_status = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
      driver_notes = CASE WHEN p_target_status = 'failed' THEN NULLIF(trim(p_reason), '') ELSE driver_notes END,
      updated_at = CASE
        WHEN v_delivery.updated_at IS NULL THEN clock_timestamp()
        ELSE GREATEST(clock_timestamp(), v_delivery.updated_at + interval '1 microsecond')
      END
  WHERE id = p_delivery_id
  RETURNING * INTO v_delivery;

  IF p_target_status = 'delivered' THEN
    PERFORM public.transition_order_status(v_delivery.order_id, 'delivered', 'Driver confirmed delivery', NULL);
  ELSIF p_target_status = 'failed' THEN
    PERFORM public.transition_order_status(v_delivery.order_id, 'failed_delivery', p_reason, NULL);
  END IF;
  PERFORM public.log_activity(
    'admin_action', 'delivery', p_delivery_id,
    jsonb_build_object(
      'action', 'delivery_status_transition', 'to', p_target_status,
      'order_id', v_delivery.order_id, 'reason', p_reason
    )
  );
  RETURN v_delivery;
END;
$function$;

-- CREATE OR REPLACE preserves the hardened grants established by 0049.
COMMIT;
