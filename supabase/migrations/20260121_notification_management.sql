-- supabase/migrations/20260121_notification_management.sql

-- Create notification_rules table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- e.g., 'check_in', 'check_out', 'violation', 'field_report', 'task_assigned'
    recipient_role TEXT,      -- e.g., 'direct_manager', 'hr', 'ops_manager', 'admin', 'finance'
    recipient_user_id UUID REFERENCES public.users(id), -- Specific user recipient
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for idempotency)
DROP POLICY IF EXISTS "notification_rules_admin_policy" ON public.notification_rules;
DROP POLICY IF EXISTS "notification_rules_read_policy" ON public.notification_rules;

-- Policy: Admin can manage rules
CREATE POLICY "notification_rules_admin_policy" ON public.notification_rules
    FOR ALL USING (public.check_is_admin());

-- Policy: Authenticated users can read rules
CREATE POLICY "notification_rules_read_policy" ON public.notification_rules
    FOR SELECT USING (auth.role() = 'authenticated');

-- Seed default rules (based on previous hardcoded logic)
INSERT INTO public.notification_rules (event_type, recipient_role)
VALUES 
    ('check_in', 'direct_manager'),
    ('check_out', 'direct_manager'),
    ('violation', 'direct_manager'),
    ('violation', 'hr'),
    ('field_report', 'ops_manager'),
    ('task_assigned', 'direct_manager')
ON CONFLICT DO NOTHING;

-- Grant access to authenticated users
GRANT ALL ON public.notification_rules TO postgres, service_role;
GRANT SELECT ON public.notification_rules TO authenticated;
