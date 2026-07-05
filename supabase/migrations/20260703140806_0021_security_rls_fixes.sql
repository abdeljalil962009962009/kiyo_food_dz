-- Security fix: Enable RLS on platform_health table
ALTER TABLE platform_health ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read platform health (for dashboard)
CREATE POLICY platform_health_select ON platform_health
  FOR SELECT TO authenticated USING (true);

-- Only super admins can update health status
CREATE POLICY platform_health_update ON platform_health
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Secure the owner_init_config table (was missing RLS policies)
DROP POLICY IF EXISTS owner_init_config_select ON owner_init_config;
CREATE POLICY owner_init_config_select ON owner_init_config
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS owner_init_config_update ON owner_init_config;
CREATE POLICY owner_init_config_update ON owner_init_config
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());