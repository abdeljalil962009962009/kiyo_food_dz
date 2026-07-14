-- Repair databases where migration 0002's operational status text column
-- prevented migration 0003 from installing the restaurant lifecycle enum.
-- This is additive/data-preserving: legacy operational values are copied to
-- operational_status before status is normalized to the lifecycle contract.
-- The existing status type is intentionally preserved because RLS policies in
-- deployed databases can depend on it; changing the type would require a risky
-- policy teardown and recreation.

BEGIN;

DO $$
BEGIN
  CREATE TYPE public.restaurant_status AS ENUM
    ('draft', 'pending_approval', 'published', 'hidden', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.restaurant_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.restaurant_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE public.restaurant_status ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE public.restaurant_status ADD VALUE IF NOT EXISTS 'hidden';
ALTER TYPE public.restaurant_status ADD VALUE IF NOT EXISTS 'suspended';

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'closed';

DO $$
DECLARE
  v_status_udt text;
  v_constraint record;
  v_has_is_active boolean;
BEGIN
  SELECT c.udt_name
  INTO v_status_udt
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'restaurants'
    AND c.column_name = 'status';

  IF v_status_udt IS NULL THEN
    ALTER TABLE public.restaurants
      ADD COLUMN status public.restaurant_status NOT NULL DEFAULT 'draft';
    RETURN;
  END IF;

  IF v_status_udt = 'restaurant_status' THEN
    RETURN;
  END IF;

  -- Preserve the value that migration 0002 used for day-to-day availability.
  UPDATE public.restaurants
  SET operational_status = CASE status::text
    WHEN 'open' THEN 'open'
    WHEN 'busy' THEN 'busy'
    WHEN 'closed' THEN 'closed'
    ELSE operational_status
  END
  WHERE status::text IN ('open', 'closed', 'busy');

  -- Remove only checks that constrain the exact lifecycle column. Checks on
  -- operational_status and other columns remain untouched.
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'restaurants'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~ '\\mstatus\\M'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.restaurants DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurants'
      AND column_name = 'is_active'
  ) INTO v_has_is_active;

  IF v_has_is_active THEN
    EXECUTE $sql$
      UPDATE public.restaurants
      SET status = CASE
        WHEN status::text IN ('draft','pending_approval','published','hidden','suspended')
          THEN status::text
        WHEN status::text IN ('open','busy') THEN 'published'
        WHEN status::text = 'closed' AND is_active THEN 'published'
        ELSE 'pending_approval'
      END
    $sql$;
  ELSE
    -- Without the historical is_active signal, legacy operational states
    -- represented existing marketplace restaurants. Preserve their visibility.
    EXECUTE $sql$
      UPDATE public.restaurants
      SET status = CASE
        WHEN status::text IN ('draft','pending_approval','published','hidden','suspended')
          THEN status::text
        WHEN status::text IN ('open','closed','busy') THEN 'published'
        ELSE 'pending_approval'
      END
    $sql$;
  END IF;

  ALTER TABLE public.restaurants
    ALTER COLUMN status SET DEFAULT 'draft',
    ALTER COLUMN status SET NOT NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.restaurants'::regclass
      AND conname = 'restaurants_status_check'
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_status_check
      CHECK (status::text IN ('draft', 'pending_approval', 'published', 'hidden', 'suspended'))
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.restaurants
  VALIDATE CONSTRAINT restaurants_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.restaurants'::regclass
      AND conname = 'restaurants_operational_status_check'
  ) THEN
    ALTER TABLE public.restaurants
      ADD CONSTRAINT restaurants_operational_status_check
      CHECK (operational_status IN ('open', 'closed', 'busy')) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.restaurants
  VALIDATE CONSTRAINT restaurants_operational_status_check;

COMMENT ON COLUMN public.restaurants.status IS
  'Platform-controlled publication lifecycle: draft, pending approval, published, hidden, or suspended.';

COMMENT ON COLUMN public.restaurants.operational_status IS
  'Restaurant-controlled day-to-day availability: open, closed, or busy.';

COMMIT;
