-- setup_break_overtime_cron.sql
-- Registers a pg_cron job that fires the check-break-overtime Edge Function
-- every 5 minutes to detect and alert users who forgot to end their break.
--
-- Prerequisites: pg_cron and pg_net extensions must be enabled.
-- Run this once in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remove any existing job with this name to avoid duplicates
SELECT cron.unschedule('check-break-overtime-job')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-break-overtime-job'
);

-- 3. Schedule the function to run every 5 minutes
SELECT cron.schedule(
  'check-break-overtime-job',
  '*/5 * * * *',  -- every 5 minutes
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/check-break-overtime',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 4. Verify the job was created
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'check-break-overtime-job';
