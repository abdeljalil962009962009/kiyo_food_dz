-- ============================================================================
-- KIYO FOOD Final — Maintenance mode setting
-- ============================================================================

INSERT INTO platform_settings (key, value, description) VALUES
  ('maintenance', '{
    "enabled": false,
    "message": "We are performing scheduled maintenance. Please check back shortly.",
    "allow_admin_access": true
  }', 'Maintenance mode — when enabled, non-admin users see a maintenance screen')
ON CONFLICT (key) DO NOTHING;
