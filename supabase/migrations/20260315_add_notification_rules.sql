-- =============================================
-- AUTOMATED NOTIFICATION SYSTEM MIGRATION (V2)
-- =============================================

-- 1. Automated Notification Rules Table
CREATE TABLE IF NOT EXISTS public.automated_notification_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- e.g., 'missed_punch_out', 'late_arrival'
    is_active BOOLEAN DEFAULT true,
    
    -- Configuration for the trigger (e.g., {"time": "22:00"})
    config JSONB DEFAULT '{}'::jsonb,
    
    -- Message Templates
    push_title_template TEXT,
    push_body_template TEXT,
    sms_template TEXT,
    
    -- Channels
    enable_push BOOLEAN DEFAULT true,
    enable_sms BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Automated Notification Logs Table
CREATE TABLE IF NOT EXISTS public.automated_notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_id UUID REFERENCES public.automated_notification_rules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    trigger_type TEXT NOT NULL,
    channel TEXT NOT NULL, -- 'push', 'sms'
    status TEXT NOT NULL, -- 'sent', 'failed'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Add Indexes
CREATE INDEX IF NOT EXISTS idx_auto_notif_logs_user ON public.automated_notification_logs(user_id, trigger_type, created_at);
CREATE INDEX IF NOT EXISTS idx_auto_notif_rules_active ON public.automated_notification_rules(is_active);

-- 4. Enable RLS
ALTER TABLE public.automated_notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_notification_logs ENABLE ROW LEVEL SECURITY;

-- 5. Policies
CREATE POLICY "Admins manage automated rules" 
ON public.automated_notification_rules FOR ALL 
USING (auth.jwt() ->> 'role' IN ('admin', 'management', 'super_admin'));

CREATE POLICY "Users view their own auto logs" 
ON public.automated_notification_logs FOR SELECT 
USING (auth.uid() = user_id);

-- 6. Updated At Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_update_automated_notification_rules_updated_at ON public.automated_notification_rules;
CREATE TRIGGER tr_update_automated_notification_rules_updated_at
    BEFORE UPDATE ON public.automated_notification_rules
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
