-- Migration: Sync all role permissions and fix Access Denied
-- Date: 2026-01-21
-- Description: Ensures all roles have fundamental permissions and operation_manager is fully configured.

-- 1. Standardize check_is_admin to include all manager/admin roles
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (select auth.uid()) 
    AND (
        role_id IN ('admin', 'hr', 'super_admin', 'operation_manager', 'developer', 'superadmin')
        OR LOWER(REPLACE(role_id, '_', ' ')) IN ('admin', 'hr', 'super admin', 'operation manager', 'developer')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 2. Ensure fundamental permissions for all roles (except unverified)
-- This ensures 'view_profile' and 'view_own_attendance' are ALWAYS present.
UPDATE public.roles 
SET permissions = (
    SELECT array_agg(DISTINCT p)
    FROM unnest(COALESCE(permissions, ARRAY[]::text[]) || ARRAY['view_profile', 'view_own_attendance']) AS p
)
WHERE id != 'unverified';

-- 3. Specific fix for operation_manager permissions
-- Merging default manager permissions to ensure they are complete.
UPDATE public.roles 
SET permissions = (
    SELECT array_agg(DISTINCT p)
    FROM unnest(
        COALESCE(permissions, ARRAY[]::text[]) || 
        ARRAY[
            'view_operations_dashboard', 'view_all_attendance', 'view_own_attendance',
            'apply_for_leave', 'manage_leave_requests', 'manage_tasks', 'access_support_desk',
            'view_my_team', 'view_field_reports', 'view_field_staff_tracking',
            'manage_geo_locations', 'view_my_locations', 'view_profile',
            'download_attendance_report',
            'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'
        ]
    ) AS p
)
WHERE id = 'operation_manager' OR id = 'Operation Manager';
