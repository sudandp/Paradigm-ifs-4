-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule the process-automated-pings edge function to run every 1 minute
-- We use a generic POST request to the Supabase API Gateway.
-- The actual URL and KEY will be injected by Supabase environment in production,
-- but for local development and standard deployments, pg_net provides a way to call it.
-- Ensure pg_net is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
    -- Remove existing cron if it was accidentally created
    PERFORM cron.unschedule('process-automated-pings-cron');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if doesn't exist
END $$;

-- Schedule the job to run every 1 minute
SELECT cron.schedule(
    'process-automated-pings-cron',
    '* * * * *',
    $$
    SELECT net.http_post(
        url:='https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/process-automated-pings',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json', 
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
        ),
        body:='{"trigger": "pg_cron"}'::jsonb,
        timeout_milliseconds:=10000
    )
    $$
);
