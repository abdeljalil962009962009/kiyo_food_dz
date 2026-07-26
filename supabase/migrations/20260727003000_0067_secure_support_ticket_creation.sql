BEGIN;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_request_id
  ON public.support_tickets (requester_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_actor_id uuid,
  p_request_id uuid,
  p_subject text,
  p_body text,
  p_category text DEFAULT 'general',
  p_priority text DEFAULT 'normal',
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_ticket public.support_tickets%ROWTYPE;
  v_subject text := trim(COALESCE(p_subject, ''));
  v_body text := trim(COALESCE(p_body, ''));
  v_category text := lower(trim(COALESCE(p_category, 'general')));
  v_priority text := lower(trim(COALESCE(p_priority, 'normal')));
  v_restaurant_id uuid;
  v_order_customer_id uuid;
BEGIN
  IF p_actor_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'A verified account and request identifier are required.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = p_actor_id
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'An active account is required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT ticket.* INTO v_ticket
  FROM public.support_tickets ticket
  WHERE ticket.requester_id = p_actor_id
    AND ticket.client_request_id = p_request_id;
  IF FOUND THEN
    RETURN to_jsonb(v_ticket);
  END IF;

  IF char_length(v_subject) < 3 OR char_length(v_subject) > 160 THEN
    RAISE EXCEPTION 'The support subject must contain between 3 and 160 characters.'
      USING ERRCODE = '22023';
  END IF;
  IF char_length(v_body) < 10 OR char_length(v_body) > 4000 THEN
    RAISE EXCEPTION 'The support message must contain between 10 and 4000 characters.'
      USING ERRCODE = '22023';
  END IF;
  IF v_category NOT IN ('general', 'bug', 'abuse', 'complaint', 'billing', 'other') THEN
    RAISE EXCEPTION 'Invalid support category.'
      USING ERRCODE = '22023';
  END IF;
  IF v_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid support priority.'
      USING ERRCODE = '22023';
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT orders.customer_id, orders.restaurant_id
    INTO v_order_customer_id, v_restaurant_id
    FROM public.orders orders
    WHERE orders.id = p_order_id;

    IF NOT FOUND OR (
      v_order_customer_id IS DISTINCT FROM p_actor_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.restaurants restaurant
        WHERE restaurant.id = v_restaurant_id
          AND restaurant.owner_id = p_actor_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.restaurant_memberships membership
        WHERE membership.restaurant_id = v_restaurant_id
          AND membership.user_id = p_actor_id
          AND membership.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.deliveries delivery
        JOIN public.drivers driver ON driver.id = delivery.driver_id
        WHERE delivery.order_id = p_order_id
          AND driver.user_id = p_actor_id
      )
    ) THEN
      RAISE EXCEPTION 'This order is not available to your account.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.support_tickets (
    requester_id,
    subject,
    body,
    category,
    priority,
    order_id,
    restaurant_id,
    client_request_id
  ) VALUES (
    p_actor_id,
    v_subject,
    v_body,
    v_category,
    v_priority,
    p_order_id,
    v_restaurant_id,
    p_request_id
  )
  RETURNING * INTO v_ticket;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    p_actor_id,
    'admin_action'::public.audit_action,
    'support_ticket_created',
    v_ticket.id,
    jsonb_build_object(
      'category', v_category,
      'priority', v_priority,
      'order_id', p_order_id,
      'restaurant_id', v_restaurant_id
    )
  );

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    metadata
  )
  SELECT
    profile.id,
    'support_reply',
    'New support request',
    v_subject,
    jsonb_build_object(
      'ticket_id', v_ticket.id,
      'order_id', p_order_id,
      'requester_id', p_actor_id
    )
  FROM public.profiles profile
  WHERE profile.role = 'super_admin'
    AND NOT COALESCE(profile.is_suspended, false);

  RETURN to_jsonb(v_ticket);
END
$function$;

REVOKE ALL ON FUNCTION public.create_support_ticket(
  uuid, uuid, text, text, text, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(
  uuid, uuid, text, text, text, text, uuid
) TO service_role;

DROP POLICY IF EXISTS tickets_insert_own ON public.support_tickets;

COMMIT;
