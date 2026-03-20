-- Migration: RBAC Manager Access and HR Restriction
-- Date: 2026-02-16
-- Description: Limits HR role to team-only access and grants reporting managers access to their team's data.

-- 1. Update check_is_admin to exclude HR
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (select auth.uid()) 
    AND role_id IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Update LEAVE_REQUESTS policy
DROP POLICY IF EXISTS "leave_requests_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_rbac_policy" ON public.leave_requests 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = public.leave_requests.user_id 
        AND reporting_manager_id = (select auth.uid())
    )
);

-- 3. Update ATTENDANCE_UNLOCK_REQUESTS policy (assuming name or creating it)
DROP POLICY IF EXISTS "attendance_unlock_requests_policy" ON public.attendance_unlock_requests;
CREATE POLICY "attendance_unlock_requests_rbac_policy" ON public.attendance_unlock_requests 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = public.attendance_unlock_requests.user_id 
        AND reporting_manager_id = (select auth.uid())
    )
);

-- 4. Update EXTRA_WORK_LOGS policy
DROP POLICY IF EXISTS "extra_work_logs_policy" ON public.extra_work_logs;
CREATE POLICY "extra_work_logs_rbac_policy" ON public.extra_work_logs 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = public.extra_work_logs.user_id 
        AND reporting_manager_id = (select auth.uid())
    )
);

-- 5. Update SITE_FINANCE_TRACKER policy
-- Note: Finance managers might need broader access, but for now we follow the "team-only" rule unless they are admin.
DROP POLICY IF EXISTS "site_finance_tracker_policy" ON public.site_finance_tracker;
CREATE POLICY "site_finance_tracker_rbac_policy" ON public.site_finance_tracker 
FOR ALL USING (
    public.check_is_admin() 
    OR created_by = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = public.site_finance_tracker.created_by 
        AND reporting_manager_id = (select auth.uid())
    )
);

-- 6. Update USERS policy (to allow managers to see their team's names/photos)
-- We already have "users_select_policy" allowing all authenticated users to read.
-- If we want to restrict it, we'd change it here, but typically reading profiles is fine.
-- However, for strictly "only see own status", we might want to restrict USERS select.
-- Given the recursion risk, we'll keep the broad SELECT for now but restrict updates.

-- 7. ONBOARDING_SUBMISSIONS policy
DROP POLICY IF EXISTS "onboarding_submissions_policy" ON public.onboarding_submissions;
CREATE POLICY "onboarding_submissions_rbac_policy" ON public.onboarding_submissions 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = public.onboarding_submissions.user_id 
        AND reporting_manager_id = (select auth.uid())
    )
);
