-- Recovery-only rollback. Running it restores the previous browser-write model,
-- so use only while rolling the application back to a pre-0072 release.
BEGIN;

DROP FUNCTION IF EXISTS public.manage_geography_control(uuid, uuid, text, jsonb);

DROP POLICY IF EXISTS zones_modify ON public.delivery_zones;
CREATE POLICY zones_modify ON public.delivery_zones
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS wilayas_all_admin ON public.wilayas;
CREATE POLICY wilayas_all_admin ON public.wilayas
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

COMMIT;
