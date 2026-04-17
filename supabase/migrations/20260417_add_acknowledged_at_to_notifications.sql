-- Migration: 20260417_add_acknowledged_at_to_notifications.sql
-- Goal: Add acknowledged_at column to notifications table to support ping acknowledge tracking.

ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE;

-- Add index to improve query performance for active pings
CREATE INDEX IF NOT EXISTS idx_notifications_acknowledged_at ON public.notifications(acknowledged_at) WHERE acknowledged_at IS NULL;

-- Enable realtime for notifications table if not already enabled
-- Note: This might already be enabled by other migrations, but adding here for safety
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;
