-- Add target_category column to automated_notification_rules
-- This allows specific rules to target only certain staff types (Office, Field, Site)

ALTER TABLE public.automated_notification_rules 
ADD COLUMN IF NOT EXISTS target_category TEXT DEFAULT 'all';

-- Update previous rules to default to 'all'
UPDATE public.automated_notification_rules SET target_category = 'all' WHERE target_category IS NULL;

-- Analysis: The backend worker (Supabase Edge Function) will need to be updated 
-- to filter users by this category during the 'missed_punch_out' check.
