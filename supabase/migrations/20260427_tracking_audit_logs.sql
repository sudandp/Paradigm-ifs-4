-- Create tracking_audit_logs table with request_id for correlation
CREATE TABLE IF NOT EXISTS tracking_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL,
    admin_id UUID REFERENCES public.users(id) NOT NULL,
    target_user_id UUID REFERENCES public.users(id) NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- pending, successful, failed
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE tracking_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins/Managers can view all tracking logs
CREATE POLICY "Admins can view all tracking logs"
ON tracking_audit_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND (
            role_id IN ('admin', 'hr', 'super_admin', 'operation_manager', 'management', 'developer')
        )
    )
);

-- Policy: Admins/Managers can insert tracking logs
CREATE POLICY "Admins can insert tracking logs"
ON tracking_audit_logs FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND (
            role_id IN ('admin', 'hr', 'super_admin', 'operation_manager', 'management', 'developer')
        )
    )
);

-- Policy: Target users can update THEIR OWN logs to 'successful'
CREATE POLICY "Users can update their own tracking status"
ON tracking_audit_logs FOR UPDATE
TO authenticated
USING (target_user_id = auth.uid())
WITH CHECK (target_user_id = auth.uid() AND status = 'successful');

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_tracking_audit_logs_request_id ON tracking_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_tracking_audit_logs_target_user ON tracking_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_audit_logs_admin ON tracking_audit_logs(admin_id);
