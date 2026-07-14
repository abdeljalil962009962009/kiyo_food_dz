-- Reconcile legacy production restaurant location columns required by the
-- canonical marketplace workflow. Additive and safe for existing data.
BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Algeria',
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

UPDATE public.restaurants
SET country = 'Algeria'
WHERE country IS NULL OR length(trim(country)) = 0;

UPDATE public.restaurants
SET location_updated_at = COALESCE(updated_at, created_at, now())
WHERE location_updated_at IS NULL
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

ALTER TABLE public.restaurants
  ALTER COLUMN country SET DEFAULT 'Algeria';

COMMENT ON COLUMN public.restaurants.country IS
  'Structured restaurant country; defaults to Algeria for legacy records.';
COMMENT ON COLUMN public.restaurants.province IS
  'Structured province/wilaya label returned by verified geocoding.';
COMMENT ON COLUMN public.restaurants.postal_code IS
  'Structured postal code returned by verified geocoding when available.';
COMMENT ON COLUMN public.restaurants.location_updated_at IS
  'Time the precise restaurant coordinates or structured location were last verified.';

COMMIT;