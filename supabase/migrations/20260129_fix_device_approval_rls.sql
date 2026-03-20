-- Migration: Fix Device Approval RLS
-- Description: Allows Admins and HR to insert user_devices for other users (required for approval workflow)
-- Created: 2026-01-29

-- Allow Admins and HR to insert into user_devices for any user
-- This is required because the approval action creates a device record for the requestor
DROP POLICY IF EXISTS "user_devices_insert_admin_hr" ON public.user_devices;
CREATE POLICY "user_devices_insert_admin_hr" 
    ON public.user_devices 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role_id IN ('admin', 'hr')
        )
    );
