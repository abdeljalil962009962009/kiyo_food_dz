-- Kiyo Food 0066: trusted restaurant replies to verified customer reviews.
-- Additive hardening: existing reviews and replies are preserved.
BEGIN;

CREATE OR REPLACE FUNCTION public.reply_to_restaurant_review(
  p_actor_id uuid,
  p_review_id uuid,
  p_reply text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_review public.reviews%ROWTYPE;
  v_reply text := btrim(COALESCE(p_reply, ''));
  v_replied_at timestamptz := now();
  v_features jsonb := '{}'::jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_review_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before replying to a review.' USING ERRCODE = '42501';
  END IF;
  IF length(v_reply) < 2 OR length(v_reply) > 1000 THEN
    RAISE EXCEPTION 'Keep the restaurant reply between 2 and 1000 characters.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(setting.value, '{}'::jsonb)
  INTO v_features
  FROM public.platform_settings setting
  WHERE setting.key = 'features';
  IF COALESCE(
    (v_features->>'reviews')::boolean,
    (v_features->>'reviews_enabled')::boolean,
    true
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'Customer reviews are currently unavailable.'
      USING ERRCODE = '55000';
  END IF;

  SELECT review.*
  INTO v_review
  FROM public.reviews review
  WHERE review.id = p_review_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The review no longer exists.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = p_actor_id
      AND NOT COALESCE(profile.is_suspended, false)
  ) OR NOT (
    EXISTS (
      SELECT 1
      FROM public.restaurant_memberships membership
      WHERE membership.restaurant_id = v_review.restaurant_id
        AND membership.user_id = p_actor_id
        AND membership.membership_role IN ('owner', 'manager')
        AND membership.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.restaurants restaurant
      WHERE restaurant.id = v_review.restaurant_id
        AND restaurant.owner_id = p_actor_id
    )
  ) THEN
    RAISE EXCEPTION 'Only an active owner or manager of this restaurant may reply.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.reviews
  SET owner_reply = v_reply,
      replied_at = v_replied_at,
      updated_at = v_replied_at
  WHERE id = v_review.id;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    p_actor_id,
    'admin_action'::public.audit_action,
    'restaurant_review_reply',
    v_review.id,
    jsonb_build_object(
      'restaurant_id', v_review.restaurant_id,
      'order_id', v_review.order_id,
      'reply_updated', v_review.owner_reply IS NOT NULL
    )
  );

  RETURN jsonb_build_object(
    'review_id', v_review.id,
    'restaurant_id', v_review.restaurant_id,
    'owner_reply', v_reply,
    'replied_at', v_replied_at
  );
END
$function$;

REVOKE ALL ON FUNCTION public.reply_to_restaurant_review(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reply_to_restaurant_review(uuid, uuid, text)
  TO service_role;

COMMIT;
