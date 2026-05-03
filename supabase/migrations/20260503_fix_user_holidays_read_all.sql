-- Migration: Allow all authenticated users to READ user_holidays
-- Description: The attendance report needs to check each employee's selected holidays
--              to determine if a day should be 'H' (Holiday) or 'A' (Absent).
--              Previously, only admin/hr could read all user holidays. Reporting
--              managers and other roles got empty results due to RLS, causing
--              incorrect 'Absent' statuses for days that should be 'Holiday'.
--
-- Fix: Add a SELECT policy that allows any authenticated user to read all
--      user_holidays rows. Write operations (INSERT/UPDATE/DELETE) remain
--      restricted to the user themselves and admin/hr.

-- Drop the restrictive per-user SELECT policy
DROP POLICY IF EXISTS "Users can view their own holiday selections" ON public.user_holidays;

-- Create an open SELECT policy for all authenticated users
-- This is safe because holiday selections are not sensitive data —
-- they simply indicate which pool holidays an employee picked.
CREATE POLICY "All authenticated users can view holiday selections"
    ON public.user_holidays FOR SELECT
    TO authenticated
    USING (true);
