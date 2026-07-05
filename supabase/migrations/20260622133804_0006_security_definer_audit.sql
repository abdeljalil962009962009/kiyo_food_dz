-- ============================================================================
-- KIYO Phase 4 — SECURITY DEFINER audit
--
-- Reviewed every function in your list. Several are SECURITY DEFINER but only
-- read tables the caller already has RLS access to. Converting them to
-- SECURITY INVOKER removes unnecessary privilege escalation surface while
-- preserving correctness (RLS still gates the underlying reads/writes).
--
-- Functions KEPT as SECURITY DEFINER (justified):
--   * handle_new_user         — trigger on auth.users, inserts profile before RLS exists
--   * promote_owner_on_login  — trigger that updates role (caller cannot)
--   * log_activity            — writes audit_logs (admin-only-write table)
--   * create_order_with_items — calls log_activity; needs the privilege chain
--   * request_personal_data_export — calls log_activity
--   * request_account_deletion    — calls log_activity
--
-- Functions converted to SECURITY INVOKER:
--   * calculate_order_financials — reads menu_items (RLS-readable)
--   * get_user_restaurant_id     — reads restaurants (RLS-readable)
--   * is_admin, is_super_admin   — reads profiles (RLS-self-readable)
--   * restaurant_is_visible      — reads restaurants (RLS-readable)
--   * set_restaurant_status      — RLS gates the underlying UPDATE
--   * set_updated_at             — trigger, no privilege escalation needed
--   * update_restaurant_rating   — placeholder no-op
-- ============================================================================

-- Use ALTER FUNCTION ... SECURITY INVOKER (preserves body, only flips flag).
ALTER FUNCTION public.calculate_order_financials(jsonb, numeric) SECURITY INVOKER;
ALTER FUNCTION public.get_user_restaurant_id() SECURITY INVOKER;
ALTER FUNCTION public.is_admin() SECURITY INVOKER;
ALTER FUNCTION public.is_super_admin() SECURITY INVOKER;
ALTER FUNCTION public.restaurant_is_visible(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.set_restaurant_status(uuid, restaurant_status) SECURITY INVOKER;
ALTER FUNCTION public.set_updated_at() SECURITY INVOKER;
ALTER FUNCTION public.update_restaurant_rating(uuid) SECURITY INVOKER;

-- Re-verify the kept-as-DEFINER ones still have hardened search_path.
-- (They already do; this is no-op safety.)
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.promote_owner_on_login() SET search_path = public, pg_temp;
ALTER FUNCTION public.log_activity(audit_action, text, uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_order_with_items(jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.request_personal_data_export() SET search_path = public, pg_temp;
ALTER FUNCTION public.request_account_deletion() SET search_path = public, pg_temp;
