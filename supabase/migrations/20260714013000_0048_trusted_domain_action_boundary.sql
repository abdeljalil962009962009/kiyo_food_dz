-- Add the trusted server boundary before switching application callers.
-- Canonical functions retain their validation and current grants in this
-- additive phase; a later migration revokes direct browser execution only
-- after the compatible application deployment has been verified.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  request_id uuid NOT NULL,
  action text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, request_id)
);

ALTER TABLE public.user_action_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_action_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_action_requests TO service_role;

DROP POLICY IF EXISTS user_action_requests_deny_browser ON public.user_action_requests;
CREATE POLICY user_action_requests_deny_browser
  ON public.user_action_requests
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.execute_user_action(
  p_actor_id uuid,
  p_request_id uuid,
  p_action text,
  p_args jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_existing public.user_action_requests%ROWTYPE;
  v_idempotent boolean := p_action IN (
    'create_order_with_items',
    'reply_to_ticket',
    'request_account_deletion',
    'request_personal_data_export',
    'send_restaurant_application_message',
    'submit_restaurant_application',
    'transition_delivery_status',
    'transition_order_status'
  );
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.' USING ERRCODE = '42501';
  END IF;
  IF p_actor_id IS NULL OR p_request_id IS NULL
     OR jsonb_typeof(COALESCE(p_args, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Invalid secure action request.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_actor_id AND NOT COALESCE(p.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'An active account is required.' USING ERRCODE = '42501';
  END IF;

  IF v_idempotent THEN
    INSERT INTO public.user_action_requests (actor_id, request_id, action, args)
    VALUES (p_actor_id, p_request_id, p_action, COALESCE(p_args, '{}'::jsonb))
    ON CONFLICT (actor_id, request_id) DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO v_existing
      FROM public.user_action_requests
      WHERE actor_id = p_actor_id AND request_id = p_request_id;
      IF v_existing.action <> p_action OR v_existing.args <> COALESCE(p_args, '{}'::jsonb) THEN
        RAISE EXCEPTION 'Idempotency key was reused for a different action.' USING ERRCODE = 'PT409';
      END IF;
      IF v_existing.completed_at IS NULL THEN
        RAISE EXCEPTION 'This action is already being processed.' USING ERRCODE = 'PT409';
      END IF;
      RETURN v_existing.result;
    END IF;
  END IF;

  -- The actor comes from a token independently verified by the server route.
  -- Existing canonical routines continue to authorize with auth.uid().
  PERFORM set_config('request.jwt.claim.sub', p_actor_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_actor_id, 'role', 'authenticated')::text,
    true
  );

  CASE p_action
    WHEN 'create_order_with_items' THEN
      v_result := public.create_order_with_items(COALESCE(p_args->'p_payload', '{}'::jsonb));
    WHEN 'get_restaurant_analytics_summary' THEN
      v_result := public.get_restaurant_analytics_summary(
        (p_args->>'p_restaurant_id')::uuid,
        COALESCE(NULLIF(p_args->>'p_days', '')::integer, 30)
      );
    WHEN 'get_restaurant_financials' THEN
      v_result := public.get_restaurant_financials((p_args->>'p_restaurant_id')::uuid);
    WHEN 'get_restaurant_publication_readiness' THEN
      v_result := public.get_restaurant_publication_readiness((p_args->>'p_restaurant_id')::uuid);
    WHEN 'get_top_products' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(result)), '[]'::jsonb) INTO v_result
      FROM public.get_top_products(
        (p_args->>'p_restaurant_id')::uuid,
        COALESCE(NULLIF(p_args->>'p_days', '')::integer, 30),
        LEAST(GREATEST(COALESCE(NULLIF(p_args->>'p_limit', '')::integer, 5), 1), 50)
      ) result;
    WHEN 'mark_restaurant_application_messages_read' THEN
      v_result := to_jsonb(public.mark_restaurant_application_messages_read(
        (p_args->>'p_application_id')::uuid
      ));
    WHEN 'quote_delivery_order_by_route' THEN
      v_result := public.quote_delivery_order_by_route(
        (p_args->>'p_route_quote_id')::uuid,
        COALESCE(p_args->'p_items', '[]'::jsonb)
      );
    WHEN 'reply_to_ticket' THEN
      v_result := to_jsonb(public.reply_to_ticket(
        (p_args->>'p_ticket_id')::uuid,
        COALESCE(p_args->>'p_body', ''),
        false
      ));
    WHEN 'request_account_deletion' THEN
      v_result := to_jsonb(public.request_account_deletion());
    WHEN 'request_personal_data_export' THEN
      v_result := to_jsonb(public.request_personal_data_export());
    WHEN 'send_restaurant_application_message' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.send_restaurant_application_message(
        (p_args->>'p_application_id')::uuid,
        COALESCE(p_args->>'p_body', ''),
        (p_args->>'p_client_message_id')::uuid
      ) result;
    WHEN 'submit_restaurant_application' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.submit_restaurant_application(
        COALESCE(p_args->'p_payload', '{}'::jsonb),
        (p_args->>'p_submission_key')::uuid
      ) result;
    WHEN 'transition_delivery_status' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.transition_delivery_status(
        (p_args->>'p_delivery_id')::uuid,
        COALESCE(p_args->>'p_target_status', ''),
        NULLIF(p_args->>'p_reason', ''),
        NULLIF(p_args->>'p_expected_updated_at', '')::timestamptz
      ) result;
    WHEN 'transition_order_status' THEN
      SELECT to_jsonb(result) INTO v_result
      FROM public.transition_order_status(
        (p_args->>'p_order_id')::uuid,
        (p_args->>'p_target_status')::public.order_status,
        NULLIF(p_args->>'p_reason', ''),
        NULLIF(p_args->>'p_expected_updated_at', '')::timestamptz
      ) result;
    WHEN 'update_driver_live_location' THEN
      v_result := public.update_driver_live_location(
        (p_args->>'p_driver_id')::uuid,
        (p_args->>'p_lat')::double precision,
        (p_args->>'p_lng')::double precision,
        NULLIF(p_args->>'p_accuracy_m', '')::numeric,
        NULLIF(p_args->>'p_heading', '')::numeric,
        NULLIF(p_args->>'p_speed_mps', '')::numeric,
        NULLIF(p_args->>'p_recorded_at', '')::timestamptz
      );
    ELSE
      RAISE EXCEPTION 'Unsupported secure action.' USING ERRCODE = '22023';
  END CASE;

  IF v_idempotent THEN
    UPDATE public.user_action_requests
    SET result = v_result, completed_at = now()
    WHERE actor_id = p_actor_id AND request_id = p_request_id;
  END IF;
  RETURN v_result;
END
$function$;

CREATE OR REPLACE FUNCTION public.execute_location_insights(
  p_actor_id uuid,
  p_lat double precision,
  p_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Trusted server authorization is required.' USING ERRCODE = '42501';
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL OR p_lat < 18 OR p_lat > 38 OR p_lng < -9 OR p_lng > 13 THEN
    RAISE EXCEPTION 'Coordinates must be inside Algeria.' USING ERRCODE = '22023';
  END IF;
  IF p_actor_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = p_actor_id AND NOT COALESCE(p.is_suspended, false)
    ) THEN
      RAISE EXCEPTION 'An active account is required.' USING ERRCODE = '42501';
    END IF;
    PERFORM set_config('request.jwt.claim.sub', p_actor_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', p_actor_id, 'role', 'authenticated')::text,
      true
    );
  END IF;
  RETURN public.get_location_insights(p_lat, p_lng);
END
$function$;

REVOKE ALL ON FUNCTION public.execute_user_action(uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_user_action(uuid, uuid, text, jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.execute_location_insights(uuid, double precision, double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_location_insights(uuid, double precision, double precision)
  TO service_role;

COMMIT;
