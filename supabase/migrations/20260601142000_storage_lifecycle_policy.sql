-- Auto-delete call recordings older than 90 days using pg_cron
-- Note: Supabase does not have a native 'storage.lifecycle_rules' table in PostgreSQL.
-- The most robust way to handle this purely via SQL in Supabase is using the pg_cron extension.

-- Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule a nightly job at midnight to delete recordings older than 90 days
SELECT cron.schedule(
  'purge-old-call-recordings',
  '0 0 * * *',
  $$
    DELETE FROM storage.objects 
    WHERE bucket_id = 'call-recordings' 
      AND created_at < NOW() - INTERVAL '90 days';
  $$
);
