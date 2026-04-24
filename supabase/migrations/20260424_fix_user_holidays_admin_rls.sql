-- Migration: Fix Admin/HR RLS policies for user_holidays
-- Description: Allows users with 'admin' or 'hr' role to manage (INSERT, UPDATE, DELETE) holiday selections for all users.

-- First, drop the existing view-only admin policy if it exists (to avoid confusion)
DROP POLICY IF EXISTS "Admins can view all holiday selections" ON public.user_holidays;

-- Create a comprehensive management policy for Admins and HR
CREATE POLICY "Admins and HR can manage all holiday selections"
    ON public.user_holidays FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role_id IN ('admin', 'hr', 'super_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role_id IN ('admin', 'hr', 'super_admin')
        )
    );
