-- Rollback for migration 0070.
-- Deploy the previous restaurant settings UI before running this rollback.

DROP TRIGGER IF EXISTS trg_guard_direct_restaurant_updates
  ON public.restaurants;
DROP FUNCTION IF EXISTS public.guard_direct_restaurant_updates();

REVOKE ALL ON FUNCTION public.update_restaurant_profile_settings(uuid, uuid, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.update_restaurant_profile_settings(uuid, uuid, jsonb, timestamptz);
