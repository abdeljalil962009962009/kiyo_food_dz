-- Add super admin read access to saved_addresses
DROP POLICY IF EXISTS saved_addresses_select_admin ON saved_addresses;
CREATE POLICY saved_addresses_select_admin ON saved_addresses
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Also add super admin read access to orders for pickup points
DROP POLICY IF EXISTS orders_select_admin_fallback ON orders;
CREATE POLICY orders_select_admin_fallback ON orders
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
