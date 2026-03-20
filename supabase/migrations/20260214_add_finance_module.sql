-- Remove old Billing module if it exists
DELETE FROM public.app_modules WHERE id = 'module_billing';

-- Add Finance Module
INSERT INTO public.app_modules (id, name, description, permissions)
VALUES (
  'module_finance',
  'Finance',
  'Manage financial records, invoices, and costing.',
  ARRAY['view_invoice_summary', 'view_verification_costing', 'manage_finance_settings', 'view_finance_reports', 'view_attendance_tracker']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;
