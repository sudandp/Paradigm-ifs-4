-- Migration: Add permissions column to roles table
-- Date: 2026-01-08
-- Description: Adds a permissions column to the roles table to persist role-specific access rights.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'roles' AND column_name = 'permissions'
    ) THEN
        ALTER TABLE public.roles ADD COLUMN permissions TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Update existing roles with some default permissions if they are empty
-- This ensures that the migration doesn't leave existing roles with no access.
-- We use the default sets from our frontend permissionsStore.

UPDATE public.roles SET permissions = '{view_all_submissions, manage_users, manage_sites, view_entity_management, view_developer_settings, view_operations_dashboard, view_site_dashboard, create_enrollment, manage_roles_and_permissions, manage_attendance_rules, view_all_attendance, view_own_attendance, apply_for_leave, manage_leave_requests, manage_approval_workflow, download_attendance_report, manage_tasks, manage_policies, manage_insurance, manage_enrollment_rules, manage_uniforms, view_invoice_summary, view_verification_costing, view_field_staff_tracking, manage_modules, access_support_desk, view_my_team, view_field_reports, manage_biometric_devices, manage_geo_locations, view_my_locations, view_profile}' WHERE id = 'admin' AND (permissions IS NULL OR permissions = '{}');

UPDATE public.roles SET permissions = '{view_all_submissions, manage_users, manage_sites, view_entity_management, manage_attendance_rules, view_all_attendance, view_own_attendance, apply_for_leave, manage_leave_requests, download_attendance_report, manage_policies, manage_insurance, manage_enrollment_rules, manage_uniforms, view_invoice_summary, view_verification_costing, access_support_desk}' WHERE id = 'hr' AND (permissions IS NULL OR permissions = '{}');

UPDATE public.roles SET permissions = '{view_invoice_summary, view_verification_costing, view_own_attendance, apply_for_leave}' WHERE id = 'finance' AND (permissions IS NULL OR permissions = '{}');

UPDATE public.roles SET permissions = '{view_developer_settings}' WHERE id = 'developer' AND (permissions IS NULL OR permissions = '{}');

UPDATE public.roles SET permissions = '{view_operations_dashboard, view_all_attendance, view_own_attendance, apply_for_leave, manage_leave_requests, manage_tasks, access_support_desk}' WHERE id = 'operation_manager' AND (permissions IS NULL OR permissions = '{}');

UPDATE public.roles SET permissions = '{view_site_dashboard, create_enrollment, view_own_attendance, apply_for_leave, access_support_desk}' WHERE id = 'site_manager' AND (permissions IS NULL OR permissions = '{}');

UPDATE public.roles SET permissions = '{create_enrollment, view_own_attendance, apply_for_leave, access_support_desk}' WHERE id = 'field_staff' AND (permissions IS NULL OR permissions = '{}');
