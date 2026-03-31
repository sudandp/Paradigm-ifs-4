-- Migration: 20260331_add_site_staff_roles.sql
-- Description: Adds technician, plumber, and multitech roles and categorizes them under 'site'.

-- 1. Add the roles to the public.roles table if they don't exist
INSERT INTO public.roles (id, display_name, permissions)
VALUES 
    ('technician', 'Technician', '{create_enrollment, view_own_attendance, apply_for_leave, access_support_desk}'),
    ('plumber', 'Plumber', '{create_enrollment, view_own_attendance, apply_for_leave, access_support_desk}'),
    ('multitech', 'Multi-Tech', '{create_enrollment, view_own_attendance, apply_for_leave, access_support_desk}'),
    ('hvac_technician', 'HVAC Technician', '{create_enrollment, view_own_attendance, apply_for_leave, access_support_desk}'),
    ('plumber_carpenter', 'Plumber / Carpenter', '{create_enrollment, view_own_attendance, apply_for_leave, access_support_desk}')
ON CONFLICT (id) DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    permissions = EXCLUDED.permissions;

-- 2. Update existing settings to include these roles in 'site' mapping
-- This ensures the UI reflects these roles in the 'Site Staff' category immediately.
UPDATE public.settings
SET attendance_settings = jsonb_set(
    attendance_settings,
    '{missedCheckoutConfig,roleMapping,site}',
    (COALESCE(attendance_settings->'missedCheckoutConfig'->'roleMapping'->'site', '[]'::jsonb) || '["technician", "plumber", "multitech", "hvac_technician", "plumber_carpenter"]'::jsonb)
)
WHERE id = 'singleton';
