-- Rollback for migration 0068.
-- Run only after deploying application code that no longer calls this function.

REVOKE ALL ON FUNCTION public.update_restaurant_operational_state(
  uuid,
  uuid,
  text,
  boolean,
  timestamptz
) FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.update_restaurant_operational_state(
  uuid,
  uuid,
  text,
  boolean,
  timestamptz
);
