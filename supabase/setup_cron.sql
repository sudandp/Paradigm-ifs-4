-- setup_cron.sql
-- 1. Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Clear existing job if it exists to avoid duplicates
SELECT cron.unschedule('process-email-schedules-job');

-- 3. Schedule the job to run every 10 minutes
SELECT cron.schedule(
    'process-email-schedules-job',
    '*/10 * * * *',
    $$
    SELECT
      net.http_post(
        url := 'https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/process-email-schedules',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU'
        ),
        body := '{}'
      ) as request_id;
    $$
);
