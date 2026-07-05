-- Enable RLS on subscription_plans table (was missing)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can read active subscription plans (for display in UI)
CREATE POLICY subscription_plans_select ON subscription_plans FOR SELECT
  TO authenticated USING (true);

-- Only super admins can modify subscription plans
CREATE POLICY subscription_plans_modify ON subscription_plans FOR ALL
  TO authenticated USING (public.is_super_admin());