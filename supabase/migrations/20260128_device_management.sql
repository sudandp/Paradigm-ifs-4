-- Migration: Device Management System
-- Description: Adds comprehensive device tracking, approval workflow, and activity logging
-- Created: 2026-01-28

-- =============================================
-- 1. CREATE TABLES
-- =============================================

-- Table: user_devices
-- Stores registered devices for each user with approval status
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_type TEXT NOT NULL CHECK (device_type IN ('web', 'android', 'ios')),
    device_identifier TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_info JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'revoked')),
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    approved_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Table: device_change_requests
-- Tracks device approval requests when users exceed limits
CREATE TABLE IF NOT EXISTS public.device_change_requests (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_type TEXT NOT NULL CHECK (device_type IN ('web', 'android', 'ios')),
    device_identifier TEXT NOT NULL,
    device_name TEXT NOT NULL,
    device_info JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    reviewed_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    reporting_manager_notified BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Table: device_activity_logs
-- Tracks login/logout activities by device
CREATE TABLE IF NOT EXISTS public.device_activity_logs (
    id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.user_devices(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('login', 'logout', 'blocked_attempt', 'registration')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    ip_address TEXT,
    location JSONB,
    device_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- =============================================
-- 2. CREATE INDEXES
-- =============================================

-- Indexes for user_devices
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_status ON public.user_devices(status);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_identifier ON public.user_devices(device_identifier);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_type ON public.user_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_type ON public.user_devices(user_id, device_type);

-- Indexes for device_change_requests
CREATE INDEX IF NOT EXISTS idx_device_change_requests_user_id ON public.device_change_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_device_change_requests_status ON public.device_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_device_change_requests_requested_at ON public.device_change_requests(requested_at DESC);

-- Indexes for device_activity_logs
CREATE INDEX IF NOT EXISTS idx_device_activity_logs_user_id ON public.device_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_device_activity_logs_device_id ON public.device_activity_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_device_activity_logs_timestamp ON public.device_activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_device_activity_logs_activity_type ON public.device_activity_logs(activity_type);

-- =============================================
-- 3. CREATE TRIGGERS FOR UPDATED_AT
-- =============================================

-- Trigger for user_devices
DROP TRIGGER IF EXISTS user_devices_set_updated_at ON public.user_devices;
CREATE TRIGGER user_devices_set_updated_at
    BEFORE UPDATE ON public.user_devices
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger for device_change_requests
DROP TRIGGER IF EXISTS device_change_requests_set_updated_at ON public.device_change_requests;
CREATE TRIGGER device_change_requests_set_updated_at
    BEFORE UPDATE ON public.device_change_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_activity_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 5. CREATE RLS POLICIES
-- =============================================

-- Policies for user_devices

-- Users can view their own devices
DROP POLICY IF EXISTS "user_devices_select_own" ON public.user_devices;
CREATE POLICY "user_devices_select_own" 
    ON public.user_devices 
    FOR SELECT 
    TO authenticated 
    USING (user_id = auth.uid());

-- Admins and HR can view all devices
DROP POLICY IF EXISTS "user_devices_select_admin_hr" ON public.user_devices;
CREATE POLICY "user_devices_select_admin_hr" 
    ON public.user_devices 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role_id IN ('admin', 'hr')
        )
    );

-- Users can insert their own device registrations
DROP POLICY IF EXISTS "user_devices_insert_own" ON public.user_devices;
CREATE POLICY "user_devices_insert_own" 
    ON public.user_devices 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid());

-- Users can update their own devices (mainly for revoking)
DROP POLICY IF EXISTS "user_devices_update_own" ON public.user_devices;
CREATE POLICY "user_devices_update_own" 
    ON public.user_devices 
    FOR UPDATE 
    TO authenticated 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admins and HR can update any device (for approvals)
DROP POLICY IF EXISTS "user_devices_update_admin_hr" ON public.user_devices;
CREATE POLICY "user_devices_update_admin_hr" 
    ON public.user_devices 
    FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role_id IN ('admin', 'hr')
        )
    );

-- Policies for device_change_requests

-- Users can view their own requests
DROP POLICY IF EXISTS "device_change_requests_select_own" ON public.device_change_requests;
CREATE POLICY "device_change_requests_select_own" 
    ON public.device_change_requests 
    FOR SELECT 
    TO authenticated 
    USING (user_id = auth.uid());

-- Admins and HR can view all requests
DROP POLICY IF EXISTS "device_change_requests_select_admin_hr" ON public.device_change_requests;
CREATE POLICY "device_change_requests_select_admin_hr" 
    ON public.device_change_requests 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role_id IN ('admin', 'hr')
        )
    );

-- Users can insert their own requests
DROP POLICY IF EXISTS "device_change_requests_insert_own" ON public.device_change_requests;
CREATE POLICY "device_change_requests_insert_own" 
    ON public.device_change_requests 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid());

-- Admins and HR can update requests (for approval/rejection)
DROP POLICY IF EXISTS "device_change_requests_update_admin_hr" ON public.device_change_requests;
CREATE POLICY "device_change_requests_update_admin_hr" 
    ON public.device_change_requests 
    FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role_id IN ('admin', 'hr')
        )
    );

-- Policies for device_activity_logs

-- Users can view their own activity logs
DROP POLICY IF EXISTS "device_activity_logs_select_own" ON public.device_activity_logs;
CREATE POLICY "device_activity_logs_select_own" 
    ON public.device_activity_logs 
    FOR SELECT 
    TO authenticated 
    USING (user_id = auth.uid());

-- Admins and HR can view all activity logs
DROP POLICY IF EXISTS "device_activity_logs_select_admin_hr" ON public.device_activity_logs;
CREATE POLICY "device_activity_logs_select_admin_hr" 
    ON public.device_activity_logs 
    FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role_id IN ('admin', 'hr')
        )
    );

-- Anyone authenticated can insert activity logs (system logging)
DROP POLICY IF EXISTS "device_activity_logs_insert" ON public.device_activity_logs;
CREATE POLICY "device_activity_logs_insert" 
    ON public.device_activity_logs 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid());

-- =============================================
-- 6. ADD DEFAULT DEVICE LIMITS TO SETTINGS
-- =============================================

-- Update the settings table to include default device limits
UPDATE public.settings 
SET attendance_settings = COALESCE(attendance_settings, '{}'::jsonb) || 
    '{
        "deviceLimits": {
            "officeStaff": {
                "web": 1,
                "android": 1,
                "ios": 1
            },
            "fieldStaff": {
                "web": 1,
                "android": 1,
                "ios": 1
            },
            "siteStaff": {
                "web": 1,
                "android": 1,
                "ios": 1
            }
        }
    }'::jsonb
WHERE id = 'singleton'
AND (attendance_settings IS NULL OR NOT attendance_settings ? 'deviceLimits');

-- =============================================
-- 7. ADD COMMENT DOCUMENTATION
-- =============================================

COMMENT ON TABLE public.user_devices IS 'Stores registered devices for each user with approval status';
COMMENT ON TABLE public.device_change_requests IS 'Tracks device approval requests when users exceed configured limits';
COMMENT ON TABLE public.device_activity_logs IS 'Tracks login/logout activities by device for audit purposes';

COMMENT ON COLUMN public.user_devices.device_type IS 'Type of device: web, android, or ios';
COMMENT ON COLUMN public.user_devices.device_identifier IS 'Unique fingerprint or device ID';
COMMENT ON COLUMN public.user_devices.status IS 'Device status: active, pending, or revoked';
COMMENT ON COLUMN public.device_change_requests.status IS 'Request status: pending, approved, or rejected';
COMMENT ON COLUMN public.device_activity_logs.activity_type IS 'Activity type: login, logout, blocked_attempt, or registration';

-- =============================================
-- 8. NOTIFICATION TRIGGERS AND FUNCTIONS
-- =============================================

-- Function to notify admins and HR about new device requests
CREATE OR REPLACE FUNCTION notify_device_request()
RETURNS TRIGGER AS $$
DECLARE
    v_user_name TEXT;
    v_user_photo_url TEXT;
    v_device_type_display TEXT;
    v_admin_id UUID;
    v_hr_id UUID;
    v_manager_id UUID;
    v_manager_name TEXT;
BEGIN
    -- Only trigger for new pending requests
    IF NEW.status = 'pending' AND (TG_OP = 'INSERT' OR OLD.status != 'pending') THEN
        -- Get user information
        SELECT name, photo_url, reporting_manager_id
        INTO v_user_name, v_user_photo_url, v_manager_id
        FROM public.users
        WHERE id = NEW.user_id;
        
        -- Format device type for display
        v_device_type_display := CASE NEW.device_type
            WHEN 'web' THEN 'Web'
            WHEN 'android' THEN 'Android'
            WHEN 'ios' THEN 'iOS'
            ELSE NEW.device_type
        END;
        
        -- Notify all admins
        INSERT INTO public.notifications (user_id, type, message, link_to)
        SELECT 
            u.id,
            'device_change_pending_approval',
            v_user_name || ' has requested approval to add a new ' || v_device_type_display || ' device: ' || NEW.device_name,
            '/admin/device-approvals'
        FROM public.users u
        WHERE u.role_id = 'admin';
        
        -- Notify all HR
        INSERT INTO public.notifications (user_id, type, message, link_to)
        SELECT 
            u.id,
            'device_change_pending_approval',
            v_user_name || ' has requested approval to add a new ' || v_device_type_display || ' device: ' || NEW.device_name,
            '/admin/device-approvals'
        FROM public.users u
        WHERE u.role_id = 'hr';
        
        -- Notify reporting manager if exists
        IF v_manager_id IS NOT NULL THEN
            SELECT name INTO v_manager_name FROM public.users WHERE id = v_manager_id;
            
            INSERT INTO public.notifications (user_id, type, message, link_to)
            VALUES (
                v_manager_id,
                'device_change_manager_notification',
                v_user_name || ' has requested approval to add a new ' || v_device_type_display || ' device. This request will be reviewed by Admin/HR.',
                '/admin/device-approvals'
            );
            
            -- Mark manager as notified
            UPDATE public.device_change_requests
            SET reporting_manager_notified = true
            WHERE id = NEW.id;
        END IF;
        
        -- Notify the user that request was submitted
        INSERT INTO public.notifications (user_id, type, message, link_to)
        VALUES (
            NEW.user_id,
            'device_change_request_submitted',
            'Your request to add ' || NEW.device_name || ' has been submitted for approval.',
            '/devices'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify user when device request is approved
CREATE OR REPLACE FUNCTION notify_device_approved()
RETURNS TRIGGER AS $$
DECLARE
    v_approver_name TEXT;
    v_device_type_display TEXT;
BEGIN
    -- Only trigger when status changes to approved
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        -- Get approver name
        SELECT name INTO v_approver_name
        FROM public.users
        WHERE id = NEW.reviewed_by_id;
        
        -- Format device type for display
        v_device_type_display := CASE NEW.device_type
            WHEN 'web' THEN 'Web'
            WHEN 'android' THEN 'Android'
            WHEN 'ios' THEN 'iOS'
            ELSE NEW.device_type
        END;
        
        -- Notify user
        INSERT INTO public.notifications (user_id, type, message, link_to)
        VALUES (
            NEW.user_id,
            'device_change_request_approved',
            'Your request to add ' || NEW.device_name || ' (' || v_device_type_display || ') has been approved by ' || COALESCE(v_approver_name, 'administrator') || '. You can now use this device.',
            '/devices'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to notify user when device request is rejected
CREATE OR REPLACE FUNCTION notify_device_rejected()
RETURNS TRIGGER AS $$
DECLARE
    v_reviewer_name TEXT;
    v_device_type_display TEXT;
    v_reason_text TEXT;
BEGIN
    -- Only trigger when status changes to rejected
    IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
        -- Get reviewer name
        SELECT name INTO v_reviewer_name
        FROM public.users
        WHERE id = NEW.reviewed_by_id;
        
        -- Format device type for display
        v_device_type_display := CASE NEW.device_type
            WHEN 'web' THEN 'Web'
            WHEN 'android' THEN 'Android'
            WHEN 'ios' THEN 'iOS'
            ELSE NEW.device_type
        END;
        
        -- Format reason
        v_reason_text := '';
        IF NEW.rejection_reason IS NOT NULL AND NEW.rejection_reason != '' THEN
            v_reason_text := ' Reason: ' || NEW.rejection_reason;
        END IF;
        
        -- Notify user
        INSERT INTO public.notifications (user_id, type, message, link_to)
        VALUES (
            NEW.user_id,
            'device_change_request_rejected',
            'Your request to add ' || NEW.device_name || ' (' || v_device_type_display || ') has been rejected by ' || COALESCE(v_reviewer_name, 'administrator') || '.' || v_reason_text,
            '/devices'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_device_request ON public.device_change_requests;
CREATE TRIGGER trigger_notify_device_request
    AFTER INSERT OR UPDATE ON public.device_change_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_device_request();

DROP TRIGGER IF EXISTS trigger_notify_device_approved ON public.device_change_requests;
CREATE TRIGGER trigger_notify_device_approved
    AFTER UPDATE ON public.device_change_requests
    FOR EACH ROW
    WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
    EXECUTE FUNCTION notify_device_approved();

DROP TRIGGER IF EXISTS trigger_notify_device_rejected ON public.device_change_requests;
CREATE TRIGGER trigger_notify_device_rejected
    AFTER UPDATE ON public.device_change_requests
    FOR EACH ROW
    WHEN (NEW.status = 'rejected' AND OLD.status != 'rejected')
    EXECUTE FUNCTION notify_device_rejected();

-- Add device notification event types to notification_rules (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_rules') THEN
        INSERT INTO public.notification_rules (event_type, recipient_role, is_enabled)
        VALUES 
            ('device_change_pending_approval', 'admin', true),
            ('device_change_pending_approval', 'hr', true),
            ('device_change_manager_notification', 'direct_manager', true)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
