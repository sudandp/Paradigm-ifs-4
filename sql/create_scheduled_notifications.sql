-- Create table for scheduled future broadcasts
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    target_role TEXT, -- Role ID or 'all'
    target_user_ids UUID[], -- Array of specific user IDs
    scheduled_at TIMESTAMPTZ NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    processed_at TIMESTAMPTZ -- When the engine actually sent it
);

-- Index for efficient cron job lookup
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_pending 
ON scheduled_notifications (scheduled_at) 
WHERE is_sent = FALSE;
