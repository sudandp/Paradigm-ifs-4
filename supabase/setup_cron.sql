-- setup_cron.sql
-- 1. Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Clear existing jobs to avoids duplicates and conflicts
-- We are UNSCHEDULING the Supabase-based trigger because we are moving to GitHub Actions.
-- This prevents the "429: Security Checkpoint" errors from Vercel.
SELECT cron.unschedule('process-email-schedules-job');

-- 3. The job is now handled by GitHub Actions (.github/workflows/scheduler.yml)
-- No SQL trigger is required anymore.
