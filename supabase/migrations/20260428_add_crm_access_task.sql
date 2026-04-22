-- Add CRM & Sales Module to Access Task Management
INSERT INTO public.app_modules (id, name, description, permissions)
VALUES (
  'module_crm',
  'CRM & Sales',
  'Manage sales pipeline, leads, property surveys, and quotations.',
  ARRAY['view_crm', 'view_crm_pipeline', 'view_crm_checklists']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;
