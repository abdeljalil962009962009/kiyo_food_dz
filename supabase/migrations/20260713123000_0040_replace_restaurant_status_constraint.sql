-- Replace the legacy restaurant status check that migration 0039 could miss.
--
-- Migration 0039 used a regular-expression match against the rendered check
-- definition. On databases where the legacy constraint retained the canonical
-- name, that match could leave the old open/closed/busy rule in place. The
-- marketplace approval transaction then failed when inserting
-- status = 'pending_approval'.

BEGIN;

DO $$
DECLARE
  v_constraint record;
BEGIN
  IF to_regclass('public.restaurants') IS NULL THEN
    RAISE EXCEPTION 'public.restaurants does not exist';
  END IF;

  -- Drop checks that directly reference the lifecycle status column. Using
  -- conkey/pg_attribute is reliable and avoids parsing rendered SQL text.
  FOR v_constraint IN
    SELECT DISTINCT con.conname
    FROM pg_constraint con
    JOIN pg_attribute attribute
      ON attribute.attrelid = con.conrelid
     AND attribute.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.restaurants'::regclass
      AND con.contype = 'c'
      AND attribute.attname = 'status'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.restaurants DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;

  ALTER TABLE public.restaurants
    ADD CONSTRAINT restaurants_status_check
    CHECK (
      status::text IN (
        'draft',
        'pending_approval',
        'published',
        'hidden',
        'suspended'
      )
    ) NOT VALID;
END $$;

ALTER TABLE public.restaurants
  VALIDATE CONSTRAINT restaurants_status_check;

COMMIT;
