-- Final server-side guard: a published restaurant that is paused/closed must
-- not receive fresh route quotes or new orders, even from a stale browser tab.

CREATE OR REPLACE FUNCTION public.guard_restaurant_accepting_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_status text;
  v_operational_status text;
BEGIN
  SELECT r.status::text, r.operational_status
  INTO v_status, v_operational_status
  FROM public.restaurants AS r
  WHERE r.id = NEW.restaurant_id;

  IF NOT FOUND OR v_status <> 'published' OR v_operational_status = 'closed' THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting orders.'
      USING ERRCODE = '55006';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_restaurant_accepting_orders() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_route_quote_restaurant_available ON public.delivery_route_quotes;
CREATE TRIGGER trg_route_quote_restaurant_available
BEFORE INSERT ON public.delivery_route_quotes
FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_accepting_orders();

DROP TRIGGER IF EXISTS trg_order_restaurant_available ON public.orders;
CREATE TRIGGER trg_order_restaurant_available
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_accepting_orders();
