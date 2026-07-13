-- Restaurant analytics must reflect authoritative orders immediately and must
-- never expose one restaurant's private metrics to another tenant.

CREATE OR REPLACE FUNCTION public.get_restaurant_analytics_summary(
  p_restaurant_id uuid,
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
  v_start timestamptz;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_restaurant(p_restaurant_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  v_start := now() - make_interval(days => v_days);

  WITH eligible_orders AS (
    SELECT o.*
    FROM public.orders o
    WHERE o.restaurant_id = p_restaurant_id
      AND o.created_at >= v_start
      AND o.status NOT IN ('cancelled', 'failed_delivery', 'refunded')
  ),
  order_stats AS (
    SELECT
      count(*)::integer AS total_orders,
      COALESCE(sum(total), 0)::numeric AS total_revenue,
      COALESCE(avg(total), 0)::numeric AS avg_order_value,
      mode() WITHIN GROUP (ORDER BY extract(hour FROM created_at)::integer) AS peak_hour
    FROM eligible_orders
  ),
  period_customers AS (
    SELECT DISTINCT customer_id
    FROM eligible_orders
    WHERE customer_id IS NOT NULL
  ),
  customer_stats AS (
    SELECT
      count(*) FILTER (WHERE first_order_at >= v_start)::integer AS new_customers,
      count(*) FILTER (WHERE first_order_at < v_start)::integer AS repeat_customers
    FROM period_customers pc
    CROSS JOIN LATERAL (
      SELECT min(previous.created_at) AS first_order_at
      FROM public.orders previous
      WHERE previous.restaurant_id = p_restaurant_id
        AND previous.customer_id = pc.customer_id
        AND previous.status NOT IN ('cancelled', 'failed_delivery', 'refunded')
    ) first_order
  ),
  review_stats AS (
    SELECT count(*)::integer AS total_reviews, avg(rating)::numeric AS avg_rating
    FROM public.reviews
    WHERE restaurant_id = p_restaurant_id
      AND created_at >= v_start
      AND is_hidden = false
  )
  SELECT jsonb_build_object(
    'period_days', v_days,
    'total_orders', os.total_orders,
    'total_revenue', os.total_revenue,
    'total_cancelled', (
      SELECT count(*) FROM public.orders o
      WHERE o.restaurant_id = p_restaurant_id
        AND o.created_at >= v_start
        AND o.status IN ('cancelled', 'failed_delivery', 'refunded')
    ),
    'avg_order_value', os.avg_order_value,
    'avg_prep_time', NULL,
    'total_reviews', rs.total_reviews,
    'avg_rating', rs.avg_rating,
    'peak_hour', os.peak_hour,
    'new_customers', cs.new_customers,
    'repeat_customers', cs.repeat_customers
  )
  INTO v_result
  FROM order_stats os
  CROSS JOIN customer_stats cs
  CROSS JOIN review_stats rs;

  RETURN COALESCE(v_result, jsonb_build_object(
    'period_days', v_days,
    'total_orders', 0,
    'total_revenue', 0,
    'total_cancelled', 0,
    'avg_order_value', 0,
    'avg_prep_time', NULL,
    'total_reviews', 0,
    'avg_rating', NULL,
    'peak_hour', NULL,
    'new_customers', 0,
    'repeat_customers', 0
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_analytics_summary(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_analytics_summary(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_top_products(
  p_restaurant_id uuid,
  p_days integer DEFAULT 30,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  orders_count bigint,
  revenue numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_days integer := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 100);
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_restaurant(p_restaurant_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(oi.menu_item_id, oi.id) AS product_id,
    max(oi.name) AS product_name,
    count(DISTINCT o.id) AS orders_count,
    COALESCE(sum(oi.quantity * oi.unit_price), 0)::numeric AS revenue
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.restaurant_id = p_restaurant_id
    AND o.created_at >= now() - make_interval(days => v_days)
    AND o.status NOT IN ('cancelled', 'failed_delivery', 'refunded')
  GROUP BY COALESCE(oi.menu_item_id, oi.id)
  ORDER BY orders_count DESC, revenue DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_top_products(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_products(uuid, integer, integer) TO authenticated;
