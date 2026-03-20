-- Migration: Fix Attendance Events for Manual Entries
-- Description: Adds missing columns and RLS policies to attendance_events table

-- 1. Ensure attendance_events has all required columns
ALTER TABLE public.attendance_events 
ADD COLUMN IF NOT EXISTS location_name TEXT,
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reason TEXT;

-- 2. Ensure Row Level Security is enabled
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Allow authorized roles to INSERT manual attendance
-- We check if the auth.uid() belongs to a user with admin, hr, or super_admin role in the public.users table
DROP POLICY IF EXISTS "Allow authorized roles to insert manual attendance" ON public.attendance_events;
CREATE POLICY "Allow authorized roles to insert manual attendance" ON public.attendance_events
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role_id IN ('admin', 'hr', 'super_admin')
    )
);

-- 4. Policy: Ensure users can see manual entries created for them (if not already covered by reading own events)
-- Note: Existing policy "Allow users to manage their own attendance" might already cover this.
-- Re-verifying read access for managers/admin
DROP POLICY IF EXISTS "Allow admin/hr/managers to read all attendance" ON public.attendance_events;
CREATE POLICY "Allow admin/hr/managers to read all attendance" ON public.attendance_events
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role_id IN ('admin', 'hr', 'super_admin', 'operation_manager', 'site_manager')
    )
);

-- 5. Ensure attendance_audit_logs table exists and has policies
CREATE TABLE IF NOT EXISTS public.attendance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id),
    target_user_id UUID REFERENCES auth.users(id),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and HR can view audit logs" ON public.attendance_audit_logs;
CREATE POLICY "Admins and HR can view audit logs" ON public.attendance_audit_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role_id IN ('admin', 'hr', 'super_admin')
    )
);

DROP POLICY IF EXISTS "Admins and HR can insert audit logs" ON public.attendance_audit_logs;
CREATE POLICY "Admins and HR can insert audit logs" ON public.attendance_audit_logs
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role_id IN ('admin', 'hr', 'super_admin')
    )
);
