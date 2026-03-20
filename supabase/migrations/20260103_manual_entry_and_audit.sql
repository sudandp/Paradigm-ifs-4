-- Migration: Add manual entry support and audit logging
-- Date: 2026-01-03

-- 1. Add columns to attendance_events for manual entry tracking
ALTER TABLE public.attendance_events 
ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reason TEXT;

-- 2. Create attendance_audit_logs table
CREATE TABLE IF NOT EXISTS public.attendance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL, -- e.g., 'MANUAL_ENTRY', 'UPDATE', 'DELETE'
    performed_by UUID REFERENCES auth.users(id),
    target_user_id UUID REFERENCES auth.users(id),
    details JSONB DEFAULT '{}'::jsonb, -- Store specific details like "Added check-in at 9:00 AM"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS on audit logs
ALTER TABLE public.attendance_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Policies for attendance_audit_logs
-- Admins and HR can view all logs
CREATE POLICY "Admins and HR can view audit logs" ON public.attendance_audit_logs
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.users 
            WHERE role IN ('admin', 'hr', 'super_admin')
        )
    );

-- Admins and HR can insert logs
CREATE POLICY "Admins and HR can insert audit logs" ON public.attendance_audit_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM public.users 
            WHERE role IN ('admin', 'hr', 'super_admin')
        )
    );

-- 5. Add indexes
CREATE INDEX IF NOT EXISTS idx_attendance_audit_logs_performed_by ON public.attendance_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_logs_target_user_id ON public.attendance_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_logs_created_at ON public.attendance_audit_logs(created_at);
