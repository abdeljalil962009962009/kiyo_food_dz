-- Recovery-only rollback for a matching pre-0073 application release.
BEGIN;
DROP FUNCTION IF EXISTS public.manage_marketing_control(uuid, uuid, text, jsonb);
CREATE POLICY promo_insert_admin ON public.promo_codes FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY promo_update_admin ON public.promo_codes FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY promo_delete_admin ON public.promo_codes FOR DELETE TO authenticated USING (public.is_super_admin());
CREATE POLICY campaigns_modify ON public.marketing_campaigns FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY flags_modify ON public.feature_flags FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY subscription_plans_modify ON public.subscription_plans FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
COMMIT;
