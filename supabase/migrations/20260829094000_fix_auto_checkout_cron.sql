-- ============================================================================
-- FIX AUTO CHECKOUT CRON SCHEDULE (trigger-missed-checkouts)
-- Date: 2026-08-29
-- Fixes:
-- 1. Updates auto-checkout-trigger to run every 15 minutes (*/15 * * * *)
-- 2. Points to current live project: fmyafuhxlorbafbacywa.supabase.co
-- 3. Sets valid Service Role Bearer token
-- ============================================================================

DO $$
BEGIN
    PERFORM cron.unschedule('auto-checkout-trigger');
    PERFORM cron.unschedule('auto-checkout-trigger-15m');
EXCEPTION WHEN OTHERS THEN
    -- Continue if job does not exist
END $$;

SELECT cron.schedule(
    'auto-checkout-trigger-15m',
    '*/15 * * * *', -- Runs every 15 minutes
    $$
    SELECT net.http_post(
        url:='https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/trigger-missed-checkouts',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
        ),
        body:='{}'::jsonb,
        timeout_milliseconds:=15000
    );
    $$
);
