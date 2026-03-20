-- Migration: Add Hr Ops and Finance Manager Roles
-- Date: 2026-02-02
-- Description: Inserts new specialized manager roles into the roles table.

-- 1. Insert Hr Ops role
INSERT INTO public.roles (id, display_name, permissions)
VALUES ('hr_ops', 'Hr Ops', '{view_all_submissions, manage_users, manage_sites, view_entity_management, view_operations_dashboard, view_site_dashboard, create_enrollment, view_all_attendance, view_own_attendance, apply_for_leave, manage_leave_requests, download_attendance_report, manage_tasks, manage_policies, manage_insurance, manage_enrollment_rules, manage_uniforms, view_invoice_summary, view_verification_costing, view_field_staff_tracking, access_support_desk, view_my_team, view_field_reports, manage_geo_locations, view_my_locations, view_profile, view_mobile_nav_home, view_mobile_nav_tasks, view_mobile_nav_profile}')
ON CONFLICT (id) DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    permissions = EXCLUDED.permissions;

-- 2. Insert Finance Manager role
INSERT INTO public.roles (id, display_name, permissions)
VALUES ('finance_manager', 'Finance Manager', '{view_all_submissions, view_entity_management, view_invoice_summary, view_verification_costing, view_own_attendance, apply_for_leave, view_profile, view_mobile_nav_home, view_mobile_nav_tasks, view_mobile_nav_profile}')
ON CONFLICT (id) DO UPDATE SET 
    display_name = EXCLUDED.display_name,
    permissions = EXCLUDED.permissions;
