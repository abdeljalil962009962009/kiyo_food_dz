-- Repair audit_action enum coverage for production admin/backend workflows.
-- Several later RPCs write specific audit actions through public.log_activity().
-- Existing databases created before those actions were registered need these values
-- added explicitly, otherwise Owner Control Center saves fail at runtime.

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'data_export_requested';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'account_deletion_requested';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'settlement_generated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'settlement_marked_paid';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'user_suspended';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'user_restored';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'restaurant_admin_update';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'platform_setting_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'force_close_order';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'update_ticket_status';
