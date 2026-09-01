-- ============================================================================
-- Migration: Fix Onboarding Submissions RLS for HR Onboarding & HR Operations
-- Date: 2026-09-01
-- ============================================================================

-- 1. Update check_is_admin() to include hr_onboarding, hr_operations, and all HR/management variants
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

-- 2. Ensure onboarding_submissions table has full SELECT, INSERT, UPDATE, DELETE permissions for HR Onboarding
DROP POLICY IF EXISTS "onboarding_submissions_rbac_mm" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_rbac_policy" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_rbac_policy_v2" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_policy" ON public.onboarding_submissions;

CREATE POLICY "onboarding_submissions_rbac_mm" ON public.onboarding_submissions 
FOR ALL USING (
    public.check_is_admin() 
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
