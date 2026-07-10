-- Kiyo Food Phase 33: verified location provenance
-- Persists the provider/source behind critical coordinates and prevents weak
-- GPS readings from being marked as verified restaurant locations.

BEGIN;

ALTER TABLE public.saved_addresses
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS commune text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Algeria',
  ADD COLUMN IF NOT EXISTS geohash text,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS location_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS location_source text;

ALTER TABLE public.restaurant_applications
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS address_quality text;

UPDATE public.saved_addresses
SET location_source = COALESCE(location_source, 'manual'),
    location_confirmed = true
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND public.kiyo_is_coordinate_in_algeria(latitude, longitude);

UPDATE public.restaurants
SET location_source = COALESCE(location_source, 'manual')
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location_verified = true;

UPDATE public.restaurant_applications
SET location_source = COALESCE(location_source, 'manual'),
    address_quality = COALESCE(address_quality, 'manual')
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location_confirmed = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_addresses_location_source_valid'
  ) THEN
    ALTER TABLE public.saved_addresses
      ADD CONSTRAINT saved_addresses_location_source_valid
      CHECK (location_source IS NULL OR location_source IN ('gps', 'network', 'manual', 'search', 'ip')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_addresses_location_confirmed_required'
  ) THEN
    ALTER TABLE public.saved_addresses
      ADD CONSTRAINT saved_addresses_location_confirmed_required
      CHECK (location_confirmed = true) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_location_source_valid'
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_location_source_valid
      CHECK (location_source IS NULL OR location_source IN ('gps', 'network', 'manual', 'search', 'ip')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_verified_location_quality'
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_verified_location_quality
      CHECK (
        status NOT IN ('pending_approval', 'published')
        OR (
          location_verified = true
          AND location_source IN ('gps', 'manual', 'search')
          AND (
            location_source IN ('manual', 'search')
            OR (location_source = 'gps' AND location_accuracy_m IS NOT NULL AND location_accuracy_m <= 50)
          )
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_applications_location_source_valid'
  ) THEN
    ALTER TABLE public.restaurant_applications
      ADD CONSTRAINT restaurant_applications_location_source_valid
      CHECK (location_source IS NULL OR location_source IN ('gps', 'network', 'manual', 'search', 'ip')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_applications_address_quality_valid'
  ) THEN
    ALTER TABLE public.restaurant_applications
      ADD CONSTRAINT restaurant_applications_address_quality_valid
      CHECK (address_quality IS NULL OR address_quality IN ('precise', 'approximate', 'manual')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_applications_verified_location_quality'
  ) THEN
    ALTER TABLE public.restaurant_applications
      ADD CONSTRAINT restaurant_applications_verified_location_quality
      CHECK (
        status NOT IN ('pending', 'approved')
        OR (
          location_confirmed = true
          AND location_source IN ('gps', 'manual', 'search')
          AND (
            location_source IN ('manual', 'search')
            OR (location_source = 'gps' AND location_accuracy_m IS NOT NULL AND location_accuracy_m <= 50)
          )
        )
      ) NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_saved_addresses_place_id
  ON public.saved_addresses(place_id)
  WHERE place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_applications_place_id
  ON public.restaurant_applications(place_id)
  WHERE place_id IS NOT NULL;

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_addresses_select_admin ON public.saved_addresses;
CREATE POLICY saved_addresses_select_admin ON public.saved_addresses
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

COMMIT;
