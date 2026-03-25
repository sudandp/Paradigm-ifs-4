-- Add max_alerts and cooldown_minutes columns to automated_notification_rules
-- This supports WhatsApp-style frequency controls

ALTER TABLE public.automated_notification_rules 
ADD COLUMN IF NOT EXISTS max_alerts INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS cooldown_minutes INTEGER DEFAULT 60;

-- Update existing rules to default values if null
UPDATE public.automated_notification_rules SET max_alerts = 1 WHERE max_alerts IS NULL;
UPDATE public.automated_notification_rules SET cooldown_minutes = 60 WHERE cooldown_minutes IS NULL;

-- Note: The Edge Functions and UI have already been updated to use these fields.
