-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    -- Remove old job if exists
    PERFORM cron.unschedule('process-automated-alerts-every-minute');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if doesn't exist
END $$;

-- Schedule the edge function to run every minute
SELECT cron.schedule(
    'process-automated-alerts-every-minute',
    '* * * * *', -- Every minute
    $$
    SELECT net.http_post(
        url:='https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/process-notification-rules',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json', 
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
        ),
        body:='{}'::jsonb
    )
    $$
);
