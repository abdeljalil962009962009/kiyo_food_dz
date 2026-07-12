-- Kiyo Food 0036: Algerian contact-phone validation and locally appropriate address details.

BEGIN;

CREATE OR REPLACE FUNCTION public.kiyo_normalize_algerian_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_digits text;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' OR p_phone !~ '^[+0-9[:space:]().-]+$' THEN
    RETURN NULL;
  END IF;

  v_digits := regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF v_digits LIKE '00213%' THEN
    v_digits := substr(v_digits, 6);
  ELSIF v_digits LIKE '213%' THEN
    v_digits := substr(v_digits, 4);
  END IF;
  IF v_digits LIKE '0%' THEN
    v_digits := substr(v_digits, 2);
  END IF;

  IF v_digits ~ '^[567][0-9]{8}$' THEN
    RETURN '+213' || v_digits;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiyo_is_valid_algerian_phone(p_phone text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.kiyo_normalize_algerian_phone(p_phone) IS NOT NULL;
$$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_algerian_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_algerian_format
  CHECK (phone IS NULL OR public.kiyo_is_valid_algerian_phone(phone)) NOT VALID;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_delivery_phone_algerian_format;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_phone_algerian_format
  CHECK (delivery_phone IS NULL OR public.kiyo_is_valid_algerian_phone(delivery_phone)) NOT VALID;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, phone, role, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    public.kiyo_normalize_algerian_phone(NEW.raw_user_meta_data->>'phone'),
    'customer'::public.user_role,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.saved_addresses.building IS 'Legacy field retained for migration safety; Kiyo Food no longer writes or displays it.';
COMMENT ON COLUMN public.saved_addresses.entrance IS 'Legacy field retained for migration safety; Kiyo Food no longer writes or displays it.';
COMMENT ON COLUMN public.saved_addresses.floor IS 'Legacy field retained for migration safety; Kiyo Food no longer writes or displays it.';
COMMENT ON COLUMN public.saved_addresses.apartment IS 'Legacy field retained for migration safety; Kiyo Food no longer writes or displays it.';
COMMENT ON COLUMN public.orders.delivery_building IS 'Legacy snapshot retained for historical compatibility; no longer written by checkout.';
COMMENT ON COLUMN public.orders.delivery_entrance IS 'Legacy snapshot retained for historical compatibility; no longer written by checkout.';
COMMENT ON COLUMN public.orders.delivery_floor IS 'Legacy snapshot retained for historical compatibility; no longer written by checkout.';
COMMENT ON COLUMN public.orders.delivery_apartment IS 'Legacy snapshot retained for historical compatibility; no longer written by checkout.';

REVOKE EXECUTE ON FUNCTION public.kiyo_normalize_algerian_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiyo_normalize_algerian_phone(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.kiyo_is_valid_algerian_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kiyo_is_valid_algerian_phone(text) TO authenticated;

COMMIT;
