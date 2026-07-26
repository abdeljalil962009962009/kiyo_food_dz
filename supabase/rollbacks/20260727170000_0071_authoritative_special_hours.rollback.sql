-- Rollback for migration 0071. Additive metadata columns are retained to avoid data loss.

REVOKE ALL ON FUNCTION public.upsert_restaurant_special_hours(uuid, uuid, date, boolean, time, time, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.upsert_restaurant_special_hours(uuid, uuid, date, boolean, time, time, text, timestamptz);

REVOKE ALL ON FUNCTION public.delete_restaurant_special_hours(uuid, uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.delete_restaurant_special_hours(uuid, uuid, uuid, timestamptz);

DROP POLICY IF EXISTS special_hours_manager_select ON public.restaurant_special_hours;
DROP POLICY IF EXISTS special_hours_modify ON public.restaurant_special_hours;
CREATE POLICY special_hours_modify ON public.restaurant_special_hours
  FOR ALL TO authenticated
  USING (public.can_manage_restaurant(restaurant_id))
  WITH CHECK (public.can_manage_restaurant(restaurant_id));
