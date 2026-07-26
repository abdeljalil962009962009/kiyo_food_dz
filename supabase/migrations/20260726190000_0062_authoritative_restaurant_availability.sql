-- One authoritative restaurant availability rule for quotes and orders.
-- Additive and data-preserving: no rows or historical orders are modified.

DROP POLICY IF EXISTS special_hours_select ON public.restaurant_special_hours;
DROP POLICY IF EXISTS special_hours_public_select ON public.restaurant_special_hours;
CREATE POLICY special_hours_public_select
  ON public.restaurant_special_hours
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.restaurants AS restaurant
    WHERE restaurant.id = restaurant_special_hours.restaurant_id
      AND restaurant.status::text = 'published'
  ));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'restaurant_special_hours'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_special_hours;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.restaurant_accepts_orders(
  p_restaurant_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant public.restaurants%ROWTYPE;
  v_timezone text;
  v_local timestamp;
  v_date date;
  v_time time;
  v_dow integer;
  v_schedule jsonb;
  v_open time;
  v_close time;
  v_special public.restaurant_special_hours%ROWTYPE;
  v_special_found boolean;
BEGIN
  SELECT *
  INTO v_restaurant
  FROM public.restaurants AS restaurant
  WHERE restaurant.id = p_restaurant_id;

  IF NOT FOUND
     OR v_restaurant.status::text <> 'published'
     OR v_restaurant.operational_status = 'closed'
     OR COALESCE(v_restaurant.is_vacation_mode, false) THEN
    RETURN false;
  END IF;

  v_timezone := COALESCE(NULLIF(v_restaurant.timezone, ''), 'Africa/Algiers');
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone) THEN
    v_timezone := 'Africa/Algiers';
  END IF;
  v_local := p_at AT TIME ZONE v_timezone;
  v_date := v_local::date;
  v_time := v_local::time;
  v_dow := extract(dow FROM v_local)::integer;

  SELECT *
  INTO v_special
  FROM public.restaurant_special_hours AS special
  WHERE special.restaurant_id = p_restaurant_id
    AND special.date = v_date;
  v_special_found := FOUND;

  IF v_special_found THEN
    IF v_special.is_closed THEN RETURN false; END IF;
    v_open := v_special.open_time;
    v_close := v_special.close_time;
    IF v_open IS NOT NULL AND v_close IS NOT NULL AND v_open <> v_close THEN
      IF (v_open < v_close AND v_time >= v_open AND v_time < v_close)
         OR (v_open > v_close AND v_time >= v_open) THEN
        RETURN true;
      END IF;
    END IF;
  ELSE
    v_schedule := COALESCE(v_restaurant.opening_hours, '{}'::jsonb) -> v_dow::text;
    IF jsonb_typeof(v_schedule) = 'object'
       AND COALESCE(v_schedule->>'open', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
       AND COALESCE(v_schedule->>'close', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
      v_open := (v_schedule->>'open')::time;
      v_close := (v_schedule->>'close')::time;
      IF (v_open < v_close AND v_time >= v_open AND v_time < v_close)
         OR (v_open > v_close AND v_time >= v_open) THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  SELECT *
  INTO v_special
  FROM public.restaurant_special_hours AS special
  WHERE special.restaurant_id = p_restaurant_id
    AND special.date = v_date - 1;
  v_special_found := FOUND;

  IF v_special_found THEN
    IF v_special.is_closed THEN RETURN false; END IF;
    v_open := v_special.open_time;
    v_close := v_special.close_time;
    RETURN v_open IS NOT NULL
      AND v_close IS NOT NULL
      AND v_open > v_close
      AND v_time < v_close;
  END IF;

  v_schedule := COALESCE(v_restaurant.opening_hours, '{}'::jsonb) -> ((v_dow + 6) % 7)::text;
  IF jsonb_typeof(v_schedule) <> 'object'
     OR COALESCE(v_schedule->>'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
     OR COALESCE(v_schedule->>'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
    RETURN false;
  END IF;
  v_open := (v_schedule->>'open')::time;
  v_close := (v_schedule->>'close')::time;
  RETURN v_open > v_close AND v_time < v_close;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restaurant_accepts_orders(uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_accepts_orders(uuid, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.guard_restaurant_accepting_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.restaurant_accepts_orders(NEW.restaurant_id, now()) THEN
    RAISE EXCEPTION 'Restaurant is not currently accepting orders.'
      USING ERRCODE = '55006';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_restaurant_accepting_orders()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_route_quote_restaurant_available ON public.delivery_route_quotes;
CREATE TRIGGER trg_route_quote_restaurant_available
BEFORE INSERT ON public.delivery_route_quotes
FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_accepting_orders();

DROP TRIGGER IF EXISTS trg_order_restaurant_available ON public.orders;
CREATE TRIGGER trg_order_restaurant_available
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_accepting_orders();
