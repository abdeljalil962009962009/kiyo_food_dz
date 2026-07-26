-- Make customer reviews a trusted, order-derived operation.
BEGIN;

DROP POLICY IF EXISTS reviews_insert_own ON public.reviews;
DROP POLICY IF EXISTS reviews_update_owner ON public.reviews;

CREATE OR REPLACE FUNCTION public.submit_order_review(
  p_actor_id uuid,
  p_order_id uuid,
  p_rating integer,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_review public.reviews%ROWTYPE;
  v_comment text := NULLIF(btrim(COALESCE(p_comment, '')), '');
  v_features jsonb := '{}'::jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before reviewing an order.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles profile
    WHERE profile.id = p_actor_id
      AND NOT COALESCE(profile.is_suspended, false)
  ) THEN
    RAISE EXCEPTION 'An active account is required.' USING ERRCODE = '42501';
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

  IF p_rating < 1 OR p_rating > 5
     OR length(COALESCE(v_comment, '')) > 1000 THEN
    RAISE EXCEPTION 'Choose a rating from 1 to 5 and keep the comment under 1000 characters.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_order.customer_id <> p_actor_id
     OR v_order.status::text <> 'delivered' THEN
    RAISE EXCEPTION 'Only the customer may review their delivered order.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_review
  FROM public.reviews
  WHERE order_id = p_order_id;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'review_id', v_review.id,
      'order_id', v_review.order_id,
      'restaurant_id', v_review.restaurant_id,
      'rating', v_review.rating,
      'idempotent_replay', true
    );
  END IF;

  INSERT INTO public.reviews (
    restaurant_id,
    customer_id,
    order_id,
    rating,
    comment
  ) VALUES (
    v_order.restaurant_id,
    p_actor_id,
    v_order.id,
    p_rating,
    v_comment
  )
  RETURNING * INTO v_review;

  INSERT INTO public.audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    p_actor_id,
    'admin_action'::public.audit_action,
    'order_review',
    v_review.id,
    jsonb_build_object(
      'order_id', v_review.order_id,
      'restaurant_id', v_review.restaurant_id,
      'rating', v_review.rating
    )
  );

  RETURN jsonb_build_object(
    'review_id', v_review.id,
    'order_id', v_review.order_id,
    'restaurant_id', v_review.restaurant_id,
    'rating', v_review.rating,
    'idempotent_replay', false
  );
END
$function$;

REVOKE ALL ON FUNCTION public.submit_order_review(uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_order_review(uuid, uuid, integer, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.update_restaurant_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_restaurant_id uuid;
  v_previous_restaurant_id uuid;
BEGIN
  v_restaurant_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.restaurant_id
    ELSE NEW.restaurant_id
  END;
  v_previous_restaurant_id := CASE
    WHEN TG_OP = 'UPDATE' AND OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id
      THEN OLD.restaurant_id
    ELSE NULL
  END;

  UPDATE public.restaurants restaurant
  SET rating = (
        SELECT COALESCE(AVG(review.rating), 0)
        FROM public.reviews review
        WHERE review.restaurant_id = v_restaurant_id
          AND NOT review.is_hidden
      ),
      review_count = (
        SELECT COUNT(*)
        FROM public.reviews review
        WHERE review.restaurant_id = v_restaurant_id
          AND NOT review.is_hidden
      )
  WHERE restaurant.id = v_restaurant_id;

  IF v_previous_restaurant_id IS NOT NULL THEN
    UPDATE public.restaurants restaurant
    SET rating = (
          SELECT COALESCE(AVG(review.rating), 0)
          FROM public.reviews review
          WHERE review.restaurant_id = v_previous_restaurant_id
            AND NOT review.is_hidden
        ),
        review_count = (
          SELECT COUNT(*)
          FROM public.reviews review
          WHERE review.restaurant_id = v_previous_restaurant_id
            AND NOT review.is_hidden
        )
    WHERE restaurant.id = v_previous_restaurant_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.update_restaurant_rating()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_update_restaurant_rating ON public.reviews;
CREATE TRIGGER trg_update_restaurant_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_restaurant_rating();

COMMIT;
