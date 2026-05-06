-- ================================================================
-- SECURITY HARDENING: Row Level Security (RLS) Policies
-- Paradigm Office 4 — Defense-in-Depth Layer 3
-- 
-- Run this migration in Supabase SQL Editor.
-- These policies ensure server-side authorization regardless of
-- client-side checks.
-- ================================================================

-- ============================================================
-- 1. SECURITY AUDIT LOGS TABLE (New)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details JSONB,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    origin TEXT,
    timestamp TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_security_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_timestamp ON security_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_severity ON security_audit_logs(severity);

-- RLS: Anyone can INSERT (to log events), only admins can SELECT
ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert security logs" ON security_audit_logs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can view security logs" ON security_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role_id IN ('admin', 'super_admin', 'developer')
        )
    );

-- ============================================================
-- 2. USERS TABLE — Enforce RLS
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT USING (auth.uid() = id);

-- Admins/HR/Management can read all user profiles
DROP POLICY IF EXISTS "Authorized roles can read all users" ON users;
CREATE POLICY "Authorized roles can read all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer', 'hr', 'management', 'hr_ops', 'finance')
        )
    );

-- Reporting managers can read their direct reports
DROP POLICY IF EXISTS "Managers can read their reports" ON users;
CREATE POLICY "Managers can read their reports" ON users
    FOR SELECT USING (
        reporting_manager_id = auth.uid() OR
        reporting_manager_2_id = auth.uid() OR
        reporting_manager_3_id = auth.uid()
    );

-- Users can update their own non-sensitive fields
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        -- Prevent self-role-escalation: role_id cannot be changed by the user themselves
        role_id = (SELECT role_id FROM users WHERE id = auth.uid())
    );

-- Only admins can update role_id (role escalation protection)
CREATE POLICY "Only admins can change roles" ON users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer')
        )
    );

-- Only admins can delete users
CREATE POLICY "Only admins can delete users" ON users
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer')
        )
    );

-- Auto-creation for first login (INSERT for auth signup)
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. ATTENDANCE EVENTS — Users can only insert their own events
-- ============================================================
ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own attendance" ON attendance_events;
CREATE POLICY "Users can insert own attendance" ON attendance_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own attendance" ON attendance_events;
CREATE POLICY "Users can read own attendance" ON attendance_events
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer', 'hr', 'management', 'hr_ops')
        ) OR
        EXISTS (
            SELECT 1 FROM users AS target 
            WHERE target.id = user_id AND (
                target.reporting_manager_id = auth.uid() OR
                target.reporting_manager_2_id = auth.uid() OR
                target.reporting_manager_3_id = auth.uid()
            )
        )
    );

-- 4. NOTIFICATIONS — Users can only read their own
-- ============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 5. LEAVE REQUESTS — Proper access control
-- ============================================================
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own leave requests" ON leave_requests
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Authorized roles can manage all leave requests" ON leave_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer', 'hr', 'management', 'hr_ops')
        )
    );

CREATE POLICY "Managers can view subordinate leave requests" ON leave_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users AS target 
            WHERE target.id = user_id AND (
                target.reporting_manager_id = auth.uid() OR
                target.reporting_manager_2_id = auth.uid() OR
                target.reporting_manager_3_id = auth.uid()
            )
        )
    );

-- ============================================================
-- 6. SETTINGS — Only admins can modify
-- ============================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON settings
    FOR SELECT USING (true);

CREATE POLICY "Only admins can modify settings" ON settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer')
        )
    );

-- ============================================================
-- 7. REFERRALS — Public insert, admin read/delete
-- ============================================================
ALTER TABLE candidate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit candidate referrals" ON candidate_referrals
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can view candidate referrals" ON candidate_referrals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer', 'hr', 'management')
        )
    );

CREATE POLICY "Only admins can delete candidate referrals" ON candidate_referrals
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer')
        )
    );

CREATE POLICY "Anyone can submit business referrals" ON business_referrals
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Only admins can view business referrals" ON business_referrals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer', 'hr', 'management')
        )
    );

CREATE POLICY "Only admins can delete business referrals" ON business_referrals
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users AS u 
            WHERE u.id = auth.uid() 
            AND u.role_id IN ('admin', 'super_admin', 'developer')
        )
    );

-- ============================================================
-- 8. APPROVE USER RPC — Server-side admin validation
-- ============================================================
CREATE OR REPLACE FUNCTION approve_user(user_id UUID, role_text TEXT)
RETURNS VOID AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- Verify the caller is an admin
    SELECT role_id INTO caller_role FROM users WHERE id = auth.uid();
    
    IF caller_role NOT IN ('admin', 'super_admin', 'developer') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can approve users';
    END IF;
    
    -- Prevent escalation to super_admin unless caller is also super_admin
    IF role_text IN ('super_admin', 'developer') AND caller_role != 'super_admin' THEN
        RAISE EXCEPTION 'Unauthorized: Only super admins can assign this role';
    END IF;
    
    UPDATE users SET role_id = role_text WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. SYNC AUTH PASSWORD RPC — Already exists, ensure SECURITY DEFINER
-- ============================================================
CREATE OR REPLACE FUNCTION sync_user_auth_password(user_id UUID, new_passcode TEXT)
RETURNS VOID AS $$
DECLARE
    caller_role TEXT;
    effective_pass TEXT;
BEGIN
    -- Only allow admins or the user themselves
    SELECT role_id INTO caller_role FROM users WHERE id = auth.uid();
    
    IF auth.uid() != user_id AND caller_role NOT IN ('admin', 'super_admin', 'developer', 'hr') THEN
        RAISE EXCEPTION 'Unauthorized: Cannot change another user password';
    END IF;
    
    -- Add PAR_ prefix for 4-digit passcodes to satisfy 6-char minimum
    IF length(new_passcode) = 4 AND new_passcode ~ '^\d{4}$' THEN
        effective_pass := 'PAR_' || new_passcode;
    ELSE
        effective_pass := new_passcode;
    END IF;
    
    -- Update auth.users password (requires SECURITY DEFINER)
    UPDATE auth.users SET encrypted_password = crypt(effective_pass, gen_salt('bf'))
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- IMPORTANT: Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION sync_user_auth_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_user(UUID, TEXT) TO authenticated;

-- ============================================================
-- 10. BIOMETRIC DEVICE KEY COLUMN
-- ============================================================
ALTER TABLE biometric_devices ADD COLUMN IF NOT EXISTS device_key TEXT;

COMMENT ON COLUMN biometric_devices.device_key IS 
    'HMAC device authentication key. Set this per-device to validate biometric push requests.';
