-- Emergency rollback for migration 0046. Apply only together with an application
-- rollback. This restores the previous privilege/policy contract but does not
-- delete data or storage objects.
BEGIN;

DROP FUNCTION IF EXISTS public.execute_owner_action(uuid, uuid, text, jsonb);
DROP TABLE IF EXISTS public.owner_action_requests;

GRANT EXECUTE ON FUNCTION public.get_platform_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_settlement_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_settlement_paid(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_suspended(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_restaurant_admin(uuid, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_platform_setting(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ticket_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_restaurant_application(uuid, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preliminarily_approve_restaurant_application(uuid, numeric, numeric, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_restaurant(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_restaurant_application_internal_notes(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_restaurant_status(uuid, public.restaurant_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_marketplace_rule_override(text, text, jsonb, timestamptz, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_marketplace_rule_override(text, text, integer, text) TO authenticated;

DROP POLICY IF EXISTS search_logs_insert ON public.search_logs;
CREATE POLICY search_logs_insert ON public.search_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS settings_select ON public.platform_settings;
CREATE POLICY settings_select ON public.platform_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS owner_config_select ON public.owner_init_config;
CREATE POLICY owner_config_select ON public.owner_init_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS platform_health_select ON public.platform_health;
CREATE POLICY platform_health_select ON public.platform_health FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS zones_select ON public.delivery_zones;
CREATE POLICY zones_select ON public.delivery_zones FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS campaigns_select ON public.marketing_campaigns;
CREATE POLICY campaigns_select ON public.marketing_campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS flags_select ON public.feature_flags;
CREATE POLICY flags_select ON public.feature_flags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS subscription_plans_select ON public.subscription_plans;
CREATE POLICY subscription_plans_select ON public.subscription_plans FOR SELECT TO authenticated USING (true);

-- Keep the sensitive bucket private even during rollback. The prior public state
-- is intentionally not restored; use signed URLs or the public image gateway.
UPDATE storage.buckets SET public = false WHERE id = 'restaurant-applications';

COMMIT;
