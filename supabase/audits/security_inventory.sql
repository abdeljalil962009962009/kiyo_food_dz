-- Read-only inventory for staging/production SQL Editor.
-- Export each result grid as CSV and attach it to the Security Advisor review.

-- 1. Functions, ownership, effective privileges, extension ownership and category.
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_userbyid(p.proowner) AS owner,
  CASE WHEN p.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security_mode,
  p.provolatile AS volatility,
  p.proconfig AS configuration,
  EXISTS (
    SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  CASE
    WHEN ext.oid IS NOT NULL THEN 'A_extension_owned'
    WHEN trigger_use.function_oid IS NOT NULL THEN 'B_internal_trigger'
    WHEN p.proname IN ('archive_old_notifications','cleanup_old_location_data','hard_delete_expired_profiles') THEN 'C_maintenance_cron'
    WHEN has_function_privilege('anon', p.oid, 'EXECUTE') THEN 'D_public_read_only_rpc'
    WHEN p.proname IN ('request_account_deletion','request_personal_data_export','mark_notification_read','mark_all_notifications_read','submit_restaurant_application','reply_to_ticket','validate_promo_code','create_order_with_items','quote_delivery_order_by_route') THEN 'E_authenticated_customer_rpc'
    WHEN p.proname IN ('can_manage_restaurant','user_can_access_restaurant','get_user_restaurant_id','transition_order_status','get_restaurant_financials','get_restaurant_analytics_summary','get_top_products') THEN 'F_restaurant_rpc'
    WHEN p.proname IN ('get_platform_analytics','get_admin_alerts','get_settlement_overview','mark_settlement_paid','set_user_suspended','publish_restaurant','update_platform_setting','update_restaurant_admin','review_restaurant_application','preliminarily_approve_restaurant_application') THEN 'G_admin_only_rpc'
    WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'H_service_role_only'
    ELSE 'I_requires_separate_review'
  END AS security_category,
  ext.extname AS extension_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_depend dep
  ON dep.classid = 'pg_proc'::regclass AND dep.objid = p.oid AND dep.deptype = 'e'
LEFT JOIN pg_extension ext ON ext.oid = dep.refobjid
LEFT JOIN (
  SELECT DISTINCT tgfoid AS function_oid FROM pg_trigger WHERE NOT tgisinternal
) trigger_use ON trigger_use.function_oid = p.oid
WHERE n.nspname IN ('public','auth','storage','extensions')
ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);

-- 2. Tables, views and RLS state. spatial_ref_sys is intentionally reported as extension-managed.
SELECT
  n.nspname AS schema_name,
  c.relname AS object_name,
  c.relkind AS object_kind,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  ext.extname AS extension_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_depend dep
  ON dep.classid = 'pg_class'::regclass AND dep.objid = c.oid AND dep.deptype = 'e'
LEFT JOIN pg_extension ext ON ext.oid = dep.refobjid
WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p','v','m')
ORDER BY n.nspname, c.relname;

-- 3. RLS policies.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public','storage')
ORDER BY schemaname, tablename, policyname;

-- 4. Storage buckets and policies.
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
FROM storage.buckets
ORDER BY id;

-- 5. Extensions and their installation schemas.
SELECT e.extname, e.extversion, n.nspname AS schema_name
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

-- 6. Application triggers.
SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  pn.nspname AS function_schema,
  p.proname AS function_name,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE NOT t.tgisinternal
ORDER BY n.nspname, c.relname, t.tgname;

-- 7. Scheduled jobs, when pg_cron is installed.
SELECT jobid, schedule, command, database, username, active
FROM cron.job
ORDER BY jobid;
