-- Migration: Fix RLS for Multi-Manager Support (V2)
-- Date: 2026-02-16
-- Description: Updates RLS policies to allow reporting_manager_2_id and reporting_manager_3_id
--              to view and manage their direct reports' data.

-- Helper function to check if auth user is ANY manager for the target user ID
-- (Not strictly necessary if we inline the logic, but keeps policies cleaner if we used a function.
--  However, for performance and simplicity in policies, we'll often inline the EXISTS check).

-- ============================================================
-- 1. USERS (Enable managers to view their team's profiles)
-- ============================================================
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy_v2" ON public.users FOR SELECT USING (
    public.check_is_admin()
    OR id = (select auth.uid())
    OR reporting_manager_id = (select auth.uid())
    OR reporting_manager_2_id = (select auth.uid())
    OR reporting_manager_3_id = (select auth.uid())
);

-- ============================================================
-- 2. ATTENDANCE_EVENTS (Enable managers to view team's events)
-- ============================================================
DROP POLICY IF EXISTS "attendance_events_select_policy" ON public.attendance_events;
CREATE POLICY "attendance_events_select_policy_v2" ON public.attendance_events 
FOR SELECT USING (
    public.check_is_admin()
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = attendance_events.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

-- ============================================================
-- 3. LEAVE_REQUESTS (Enable managers to view team's leaves)
-- ============================================================
DROP POLICY IF EXISTS "leave_requests_rbac_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_policy" ON public.leave_requests; -- Cleanup old if exists
CREATE POLICY "leave_requests_rbac_policy_v2" ON public.leave_requests 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = leave_requests.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

-- ============================================================
-- 4. ATTENDANCE_UNLOCK_REQUESTS (Enable managers to view team's unlock requests)
-- ============================================================
DROP POLICY IF EXISTS "attendance_unlock_requests_rbac_policy" ON public.attendance_unlock_requests;
DROP POLICY IF EXISTS "attendance_unlock_requests_policy" ON public.attendance_unlock_requests; -- Cleanup
CREATE POLICY "attendance_unlock_requests_rbac_policy_v2" ON public.attendance_unlock_requests 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = attendance_unlock_requests.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

-- ============================================================
-- 5. EXTRA_WORK_LOGS (Enable managers to view team's extra work)
-- ============================================================
DROP POLICY IF EXISTS "extra_work_logs_rbac_policy" ON public.extra_work_logs;
DROP POLICY IF EXISTS "extra_work_logs_policy" ON public.extra_work_logs; -- Cleanup
CREATE POLICY "extra_work_logs_rbac_policy_v2" ON public.extra_work_logs 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = extra_work_logs.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

-- ============================================================
-- 6. SITE_FINANCE_TRACKER (Enable managers to view team's finance records)
-- ============================================================
DROP POLICY IF EXISTS "site_finance_tracker_rbac_policy" ON public.site_finance_tracker;
DROP POLICY IF EXISTS "site_finance_tracker_policy" ON public.site_finance_tracker; -- Cleanup
CREATE POLICY "site_finance_tracker_rbac_policy_v2" ON public.site_finance_tracker 
FOR ALL USING (
    public.check_is_admin() 
    OR created_by = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = site_finance_tracker.created_by 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

-- ============================================================
-- 7. ONBOARDING_SUBMISSIONS (Enable managers to view team's onboarding)
-- ============================================================
DROP POLICY IF EXISTS "onboarding_submissions_rbac_policy" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_policy" ON public.onboarding_submissions; -- Cleanup
CREATE POLICY "onboarding_submissions_rbac_policy_v2" ON public.onboarding_submissions 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
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

-- ============================================================
-- 8. ATTENDANCE_VIOLATIONS (Enable managers to view team's violations)
-- ============================================================
-- Note: Replaces "attendance_violations_select" and others if they were strictly single-manager
DROP POLICY IF EXISTS "attendance_violations_select" ON public.attendance_violations;
CREATE POLICY "attendance_violations_select_v2" ON public.attendance_violations 
FOR SELECT USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = attendance_violations.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

-- Managers should also be able to update (e.g. acknowledge/reset) violations?
-- The existing policy "attendance_violations_mod" usually covered inserts/updates by admin/system.
-- If managers need to acknowledge, we might need an UPDATE policy.
-- Keeping it simple for now as SELECT is the main visibility blocker.

-- ============================================================
-- 9. USER_DEVICES (Enable managers to view/manage team's devices)
-- ============================================================
DROP POLICY IF EXISTS "user_devices_select_admin_hr" ON public.user_devices; 
-- We'll creating a unified "user_devices_select_manager" instead of just admin/hr
CREATE POLICY "user_devices_select_manager" ON public.user_devices 
FOR SELECT USING (
    public.check_is_admin()
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = user_devices.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

-- ============================================================
-- 10. FIELD_REPORTS (Enable managers to view team's field reports)
-- ============================================================
DROP POLICY IF EXISTS "field_reports_policy" ON public.field_reports;
CREATE POLICY "field_reports_policy_v2" ON public.field_reports 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = field_reports.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

-- ============================================================
-- 11. FIELD_ATTENDANCE_VIOLATIONS
-- ============================================================
DROP POLICY IF EXISTS "Managers can view team violations" ON public.field_attendance_violations;
CREATE POLICY "Managers can view team violations_v2" ON public.field_attendance_violations 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = field_attendance_violations.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

DROP POLICY IF EXISTS "Managers can acknowledge violations" ON public.field_attendance_violations;
CREATE POLICY "Managers can acknowledge violations_v2" ON public.field_attendance_violations 
FOR UPDATE USING (
    acknowledged_by = (select auth.uid()) OR
    escalated_to = (select auth.uid()) OR
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = field_attendance_violations.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);
