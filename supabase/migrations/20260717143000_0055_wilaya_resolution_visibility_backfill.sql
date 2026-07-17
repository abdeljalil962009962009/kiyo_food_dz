-- Ensure restaurant applications and restaurants always carry the structured
-- wilaya_id used by customer discovery. This is additive and non-destructive.

CREATE OR REPLACE FUNCTION public.kiyo_normalize_wilaya_text(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      lower(translate(
        coalesce(p_value, ''),
        'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ’''-',
        'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyy    '
      )),
      '\b(wilaya|wilayat|province|state|governorate|gouvernorat|de|du|d|algerie|algeria|dz)\b',
      ' ',
      'gi'
    ),
    '[^[:alnum:]]+',
    ' ',
    'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.kiyo_match_wilaya_id(p_value text)
RETURNS smallint
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_candidate text;
  v_wilaya_id smallint;
BEGIN
  v_candidate := public.kiyo_normalize_wilaya_text(p_value);
  IF v_candidate IS NULL OR v_candidate = '' THEN
    RETURN NULL;
  END IF;

  SELECT w.id
  INTO v_wilaya_id
  FROM public.wilayas AS w
  CROSS JOIN LATERAL (
    VALUES
      (public.kiyo_normalize_wilaya_text(w.name_en), 100),
      (public.kiyo_normalize_wilaya_text(w.name_fr), 100),
      (public.kiyo_normalize_wilaya_text(w.name_ar), 100),
      (public.kiyo_normalize_wilaya_text(w.code), 95),
      (public.kiyo_normalize_wilaya_text(w.id::text), 90),
      (public.kiyo_normalize_wilaya_text(lpad(w.id::text, 2, '0')), 90)
  ) AS alias(alias_text, exact_score)
  WHERE alias.alias_text <> ''
    AND (
      v_candidate = alias.alias_text
      OR v_candidate LIKE alias.alias_text || ' %'
      OR v_candidate LIKE '% ' || alias.alias_text
      OR v_candidate LIKE '% ' || alias.alias_text || ' %'
    )
  ORDER BY
    CASE WHEN v_candidate = alias.alias_text THEN alias.exact_score ELSE alias.exact_score - 25 END DESC,
    length(alias.alias_text) DESC
  LIMIT 1;

  RETURN v_wilaya_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kiyo_resolve_wilaya_id(
  p_existing_wilaya_id smallint,
  p_province text,
  p_city text,
  p_commune text,
  p_address text
)
RETURNS smallint
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    p_existing_wilaya_id,
    public.kiyo_match_wilaya_id(p_province),
    public.kiyo_match_wilaya_id(p_city),
    public.kiyo_match_wilaya_id(p_commune),
    public.kiyo_match_wilaya_id(p_address)
  );
$$;

CREATE OR REPLACE FUNCTION public.kiyo_fill_location_wilaya_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.wilaya_id := public.kiyo_resolve_wilaya_id(
    NEW.wilaya_id,
    NEW.province,
    NEW.city,
    NEW.commune,
    NEW.address
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_applications_fill_wilaya_id ON public.restaurant_applications;
CREATE TRIGGER trg_restaurant_applications_fill_wilaya_id
BEFORE INSERT OR UPDATE OF wilaya_id, province, city, commune, address
ON public.restaurant_applications
FOR EACH ROW
EXECUTE FUNCTION public.kiyo_fill_location_wilaya_id();

DROP TRIGGER IF EXISTS trg_restaurants_fill_wilaya_id ON public.restaurants;
CREATE TRIGGER trg_restaurants_fill_wilaya_id
BEFORE INSERT OR UPDATE OF wilaya_id, province, city, commune, address
ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.kiyo_fill_location_wilaya_id();

UPDATE public.restaurant_applications AS a
SET wilaya_id = public.kiyo_resolve_wilaya_id(a.wilaya_id, a.province, a.city, a.commune, a.address),
    updated_at = now()
WHERE a.wilaya_id IS NULL
  AND public.kiyo_resolve_wilaya_id(a.wilaya_id, a.province, a.city, a.commune, a.address) IS NOT NULL;

UPDATE public.restaurants AS r
SET wilaya_id = public.kiyo_resolve_wilaya_id(r.wilaya_id, r.province, r.city, r.commune, r.address),
    updated_at = now()
WHERE r.wilaya_id IS NULL
  AND public.kiyo_resolve_wilaya_id(r.wilaya_id, r.province, r.city, r.commune, r.address) IS NOT NULL;

REVOKE EXECUTE ON FUNCTION public.kiyo_normalize_wilaya_text(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiyo_match_wilaya_id(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiyo_resolve_wilaya_id(smallint, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kiyo_fill_location_wilaya_id() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_restaurants_published_wilaya
  ON public.restaurants (wilaya_id, status)
  WHERE status = 'published';

COMMENT ON FUNCTION public.kiyo_resolve_wilaya_id(smallint, text, text, text, text)
  IS 'Server-side Algeria wilaya resolver used to keep customer discovery aligned with restaurant/application location data.';
