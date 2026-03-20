-- Migration: Upgrade Management Role Permissions
-- Date: 2026-02-02
-- Description: Ensures management role exists and has full admin permissions.

-- 1. Ensure the management role exists
INSERT INTO public.roles (id, display_name)
VALUES ('management', 'Management')
ON CONFLICT (id) DO NOTHING;

-- 2. Update permissions for the management role to match admin
UPDATE public.roles 
SET permissions = '{view_all_submissions, manage_users, manage_sites, view_entity_management, view_developer_settings, view_operations_dashboard, view_site_dashboard, create_enrollment, manage_roles_and_permissions, manage_attendance_rules, view_all_attendance, view_own_attendance, apply_for_leave, manage_leave_requests, manage_approval_workflow, download_attendance_report, manage_tasks, manage_policies, manage_insurance, manage_enrollment_rules, manage_uniforms, view_invoice_summary, view_verification_costing, view_field_staff_tracking, manage_modules, access_support_desk, view_my_team, view_field_reports, manage_biometric_devices, manage_geo_locations, view_my_locations, view_profile, view_mobile_nav_home, view_mobile_nav_tasks, view_mobile_nav_profile}'
WHERE id = 'management';
