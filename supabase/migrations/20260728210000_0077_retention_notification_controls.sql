-- Kiyo Food 0077: configurable retention timing for cart reminders and win-back nudges.
-- This migration is additive and does not send notifications or modify customer data.

BEGIN;

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'retention',
  '{
    "abandoned_cart_enabled": true,
    "abandoned_cart_minutes": 30,
    "winback_enabled": true,
    "winback_days": 14,
    "max_abandoned_cart_reminders_per_cart": 1,
    "max_winback_notifications_per_customer_per_days": 14
  }'::jsonb,
  'Customer retention timing for abandoned-cart reminders and inactive-customer win-back nudges'
)
ON CONFLICT (key) DO UPDATE SET
  value = COALESCE(platform_settings.value, '{}'::jsonb)
    || jsonb_build_object(
      'abandoned_cart_enabled', COALESCE((platform_settings.value->>'abandoned_cart_enabled')::boolean, true),
      'abandoned_cart_minutes', GREATEST(COALESCE((platform_settings.value->>'abandoned_cart_minutes')::integer, 30), 1),
      'winback_enabled', COALESCE((platform_settings.value->>'winback_enabled')::boolean, true),
      'winback_days', GREATEST(COALESCE((platform_settings.value->>'winback_days')::integer, 14), 1),
      'max_abandoned_cart_reminders_per_cart', GREATEST(COALESCE((platform_settings.value->>'max_abandoned_cart_reminders_per_cart')::integer, 1), 1),
      'max_winback_notifications_per_customer_per_days', GREATEST(COALESCE((platform_settings.value->>'max_winback_notifications_per_customer_per_days')::integer, 14), 1)
    ),
  description = EXCLUDED.description;

COMMIT;
