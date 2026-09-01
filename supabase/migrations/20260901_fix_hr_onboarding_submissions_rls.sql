-- ============================================================================
-- Complete Migration: Enable Full Onboarding Access for HR Onboarding & Roles with Permissions
-- Date: 2026-09-01
-- ============================================================================

-- 1. Ensure hr_onboarding role exists in public.roles with view_all_submissions permission
INSERT INTO public.roles (id, display_name, permissions)
VALUES (
  'hr_onboarding', 
  'HR Onboarding', 
  ARRAY['view_all_submissions', 'create_enrollment', 'manage_users', 'manage_sites', 'view_entity_management', 'view_all_attendance', 'view_own_attendance', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile']
)
ON CONFLICT (id) DO UPDATE 
SET permissions = ARRAY['view_all_submissions', 'create_enrollment', 'manage_users', 'manage_sites', 'view_entity_management', 'view_all_attendance', 'view_own_attendance', 'view_profile', 'view_mobile_nav_home', 'view_mobile_nav_tasks', 'view_mobile_nav_profile'];

-- 2. Helper function to check if user has a specific permission or admin/HR role
CREATE OR REPLACE FUNCTION public.check_has_permission(p_permission text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.users u
    LEFT JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = (select auth.uid())
    AND (
      p_permission = ANY(r.permissions)
      OR u.role_id IN (
        'admin', 'super_admin', 'superadmin', 'developer', 'director', 'management', 'general_manager',
        'hr', 'hr_ops', 'hr_operations', 'hr_onboarding', 'hr_manager', 'operations_head', 'ops_manager',
        'field_manager', 'finance', 'finance_manager', 'site_manager'
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Update check_is_admin() to include hr_onboarding and all management/HR variants
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (select auth.uid()) 
    AND role_id IN (
      'admin', 'super_admin', 'superadmin', 'developer', 'director', 'management', 'general_manager',
      'hr', 'hr_ops', 'hr_operations', 'hr_onboarding', 'hr_manager', 'operations_head', 'ops_manager',
      'field_manager', 'finance', 'finance_manager', 'site_manager'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Update onboarding_submissions RLS policy so any user with permission or HR role sees all submissions
DROP POLICY IF EXISTS "onboarding_submissions_rbac_mm" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_rbac_policy" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_rbac_policy_v2" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_policy" ON public.onboarding_submissions;

CREATE POLICY "onboarding_submissions_rbac_mm" ON public.onboarding_submissions 
FOR ALL USING (
    public.check_is_admin() 
    OR public.check_has_permission('view_all_submissions')
    OR user_id = (select auth.uid())
    OR created_user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = onboarding_submissions.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);
