-- Add Mobile Navigation Module
INSERT INTO public.app_modules (id, name, description, permissions)
VALUES (
  'module_mobile_nav',
  'Mobile Navigation',
  'Manage visibility of mobile navigation bar items.',
  ARRAY['view_mobile_nav_home', 'view_mobile_nav_attendance', 'view_mobile_nav_tasks', 'view_mobile_nav_profile']
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions;
