-- ============================================================================
-- DATABASE HOTFIX: RLS AND PERMISSION FIXES FOR NOTIFICATIONS & SECURITY AUDIT LOGS
-- ============================================================================

-- 1. Fix public.notifications RLS Insert Policy
-- Ensure RLS is active on notifications table
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- Grant permissions to appropriate roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon;

-- Recreate the policy to allow system triggers, anon page actions, and authenticated users to write notifications
DROP POLICY IF EXISTS "Allow system and users to insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Allow system and users to insert notifications"
ON public.notifications 
FOR INSERT 
TO public
WITH CHECK (true);


-- 2. Fix public.security_audit_logs Permissions & RLS
-- Ensure RLS is active on security_audit_logs table
ALTER TABLE IF EXISTS public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Grant SELECT & INSERT permissions to authenticated users and anon users so they can log security events
GRANT SELECT, INSERT ON public.security_audit_logs TO authenticated;
GRANT SELECT, INSERT ON public.security_audit_logs TO service_role;
GRANT SELECT, INSERT ON public.security_audit_logs TO anon;

-- Recreate RLS policies for security_audit_logs
DROP POLICY IF EXISTS "security_audit_logs_select" ON public.security_audit_logs;
DROP POLICY IF EXISTS "security_audit_logs_insert" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert security logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Only admins can view security logs" ON public.security_audit_logs;

-- Select is only for admins and security auditors
CREATE POLICY "security_audit_logs_select" 
ON public.security_audit_logs 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
    AND u.role_id IN ('admin', 'super_admin', 'security_auditor', 'developer')
  )
);

-- Anyone can insert security audit logs (since login failures/actions can happen anonymously or by low-privilege roles)
CREATE POLICY "security_audit_logs_insert" 
ON public.security_audit_logs 
FOR INSERT 
TO public
WITH CHECK (true);
