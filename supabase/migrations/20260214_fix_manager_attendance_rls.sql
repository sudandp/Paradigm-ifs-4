-- Migration: Allow managers to read their direct reports' attendance & profiles
-- Date: 2026-02-14
-- Description: The RLS on attendance_events and users only allowed admin/hr/super_admin
--              (via check_is_admin()) to read all records. Managers like finance_manager
--              could not see their team members' attendance data.
--              This migration adds reporting-manager-based access so any user who is
--              someone's reporting_manager can view that person's profile and events.

-- ============================================================
-- 1. ATTENDANCE_EVENTS – split into SELECT vs modify policies
-- ============================================================
DROP POLICY IF EXISTS "attendance_events_policy" ON public.attendance_events;
DROP POLICY IF EXISTS "attendance_events_select_policy" ON public.attendance_events;
DROP POLICY IF EXISTS "attendance_events_modify_policy" ON public.attendance_events;

-- SELECT: admin/hr OR own events OR events of direct reports
CREATE POLICY "attendance_events_select_policy" ON public.attendance_events 
FOR SELECT USING (
    public.check_is_admin()
    OR user_id = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = attendance_events.user_id 
        AND reporting_manager_id = (select auth.uid())
    )
);

-- INSERT/UPDATE/DELETE: admin/hr OR own events only
CREATE POLICY "attendance_events_modify_policy" ON public.attendance_events 
FOR INSERT WITH CHECK (
    public.check_is_admin() OR user_id = (select auth.uid())
);
CREATE POLICY "attendance_events_update_policy" ON public.attendance_events 
FOR UPDATE USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);
CREATE POLICY "attendance_events_delete_policy" ON public.attendance_events 
FOR DELETE USING (
    public.check_is_admin() OR user_id = (select auth.uid())
);

-- ============================================================
-- 2. USERS – allow managers to see their direct reports
-- ============================================================
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users FOR SELECT USING (
    public.check_is_admin()
    OR id = (select auth.uid())
    OR reporting_manager_id = (select auth.uid())
);
