-- Migration: Combined RLS Fix for Multi-Manager + Recursion Prevention
-- Date: 2026-02-16
-- Description: 
--   This SINGLE migration does two things:
--   1. Fixes the users table SELECT policy to use USING(true) instead of check_is_admin()
--      to prevent infinite recursion when non-admin roles query users.
--   2. Updates all team-related tables so that reporting_manager_2_id and reporting_manager_3_id
--      are also used for visibility (multi-manager support).
--
-- IMPORTANT: Run this in Supabase SQL Editor as a single batch.

-- ============================================================
-- PART A: FIX USERS TABLE (prevent recursion)
-- ============================================================
-- Drop ALL possible select policies to clear conflicting policies
DROP POLICY IF EXISTS "users_select_policy_v2" ON public.users;
DROP POLICY IF EXISTS "users_select_policy_final" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins and HR can view all users" ON public.users;
DROP POLICY IF EXISTS "Allow admin/hr to read all profiles" ON public.users;

-- Create a safe, non-recursive SELECT policy for users.
-- This allows ALL authenticated users to read profiles, preventing the
-- check_is_admin() recursion that crashes queries for non-admin roles.
CREATE POLICY "users_select_all_authenticated" ON public.users 
FOR SELECT 
TO authenticated 
USING (true);

-- ============================================================
-- PART B: MULTI-MANAGER RLS FOR DATA TABLES
-- ============================================================
-- These policies use EXISTS(SELECT 1 FROM users WHERE ...) which is now
-- safe because the users table has USING(true) for SELECT.

-- 2. ATTENDANCE_EVENTS
DROP POLICY IF EXISTS "attendance_events_select_policy" ON public.attendance_events;
DROP POLICY IF EXISTS "attendance_events_select_policy_v2" ON public.attendance_events;
CREATE POLICY "attendance_events_select_mm" ON public.attendance_events 
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

-- 3. LEAVE_REQUESTS
DROP POLICY IF EXISTS "leave_requests_rbac_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_rbac_policy_v2" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_rbac_mm" ON public.leave_requests 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR current_approver_id = (select auth.uid())
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

-- 4. ATTENDANCE_UNLOCK_REQUESTS
DROP POLICY IF EXISTS "attendance_unlock_requests_rbac_policy" ON public.attendance_unlock_requests;
DROP POLICY IF EXISTS "attendance_unlock_requests_rbac_policy_v2" ON public.attendance_unlock_requests;
DROP POLICY IF EXISTS "attendance_unlock_requests_policy" ON public.attendance_unlock_requests;
CREATE POLICY "attendance_unlock_requests_rbac_mm" ON public.attendance_unlock_requests 
FOR ALL USING (
    public.check_is_admin() 
    OR user_id = (select auth.uid())
    OR manager_id = (select auth.uid())
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

-- 5. EXTRA_WORK_LOGS
DROP POLICY IF EXISTS "extra_work_logs_rbac_policy" ON public.extra_work_logs;
DROP POLICY IF EXISTS "extra_work_logs_rbac_policy_v2" ON public.extra_work_logs;
DROP POLICY IF EXISTS "extra_work_logs_policy" ON public.extra_work_logs;
CREATE POLICY "extra_work_logs_rbac_mm" ON public.extra_work_logs 
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

-- 6. SITE_FINANCE_TRACKER
DROP POLICY IF EXISTS "site_finance_tracker_rbac_policy" ON public.site_finance_tracker;
DROP POLICY IF EXISTS "site_finance_tracker_rbac_policy_v2" ON public.site_finance_tracker;
DROP POLICY IF EXISTS "site_finance_tracker_policy" ON public.site_finance_tracker;
CREATE POLICY "site_finance_tracker_rbac_mm" ON public.site_finance_tracker 
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

-- 7. ONBOARDING_SUBMISSIONS
DROP POLICY IF EXISTS "onboarding_submissions_rbac_policy" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_rbac_policy_v2" ON public.onboarding_submissions;
DROP POLICY IF EXISTS "onboarding_submissions_policy" ON public.onboarding_submissions;
CREATE POLICY "onboarding_submissions_rbac_mm" ON public.onboarding_submissions 
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

-- 8. ATTENDANCE_VIOLATIONS
DROP POLICY IF EXISTS "attendance_violations_select" ON public.attendance_violations;
DROP POLICY IF EXISTS "attendance_violations_select_v2" ON public.attendance_violations;
CREATE POLICY "attendance_violations_select_mm" ON public.attendance_violations 
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

-- 9. USER_DEVICES
DROP POLICY IF EXISTS "user_devices_select_admin_hr" ON public.user_devices;
DROP POLICY IF EXISTS "user_devices_select_manager" ON public.user_devices;
CREATE POLICY "user_devices_select_mm" ON public.user_devices 
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

-- 10. FIELD_REPORTS
DROP POLICY IF EXISTS "field_reports_policy" ON public.field_reports;
DROP POLICY IF EXISTS "field_reports_policy_v2" ON public.field_reports;
CREATE POLICY "field_reports_policy_mm" ON public.field_reports 
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

-- 11. FIELD_ATTENDANCE_VIOLATIONS
DROP POLICY IF EXISTS "Managers can view team violations" ON public.field_attendance_violations;
DROP POLICY IF EXISTS "Managers can view team violations_v2" ON public.field_attendance_violations;
CREATE POLICY "field_violations_select_mm" ON public.field_attendance_violations 
FOR SELECT USING (
    public.check_is_admin()
    OR user_id = (select auth.uid())
    OR EXISTS (
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
DROP POLICY IF EXISTS "Managers can acknowledge violations_v2" ON public.field_attendance_violations;
CREATE POLICY "field_violations_update_mm" ON public.field_attendance_violations 
FOR UPDATE USING (
    public.check_is_admin()
    OR acknowledged_by = (select auth.uid())
    OR escalated_to = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = field_attendance_violations.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);
