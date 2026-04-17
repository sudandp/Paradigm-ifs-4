-- Make sure required extensions are active
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    -- Remove existing cron if it was accidentally created
    PERFORM cron.unschedule('process-email-schedules-cron');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if doesn't exist
END $$;

-- Since Supabase Edge Functions trigger smoothly, this will hit the endpoint every 10 minutes.
SELECT cron.schedule(
    'process-email-schedules-cron',
    '*/10 * * * *',
    $$
    SELECT net.http_post(
        url:='https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/process-email-schedules',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json', 
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
        ),
        body:='{"trigger": "pg_cron"}'::jsonb,
        timeout_milliseconds:=10000
    )
    $$
);
