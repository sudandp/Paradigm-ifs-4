-- Migration: Fix RLS for violation resets and salary hold updates
-- Description: Allows managers to reset violations and update salary holds for their direct reports.

-- 1. Violation Resets
DROP POLICY IF EXISTS "violation_resets_insert_manager" ON public.violation_resets;
CREATE POLICY "violation_resets_insert_manager" ON public.violation_resets FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = violation_resets.user_id 
        AND (
            reporting_manager_id = (select auth.uid()) OR
            reporting_manager_2_id = (select auth.uid()) OR
            reporting_manager_3_id = (select auth.uid())
        )
    )
);

-- 2. Users (Allow managers to update their reports - needed for salary_hold)
DROP POLICY IF EXISTS "Managers can update team users" ON public.users;
CREATE POLICY "Managers can update team users" ON public.users FOR UPDATE USING (
    reporting_manager_id = (select auth.uid()) OR
    reporting_manager_2_id = (select auth.uid()) OR
    reporting_manager_3_id = (select auth.uid())
);

-- Note: field_attendance_violations UPDATE policy for managers already exists in 20260216_fix_multi_manager_rls_v2.sql
