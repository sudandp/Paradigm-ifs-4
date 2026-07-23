-- ============================================================================
-- CRON & INDEX WARNINGS REMEDIATION MIGRATION
-- Date: 2026-07-23
-- Fixes recurring Postgres ERROR (relation net.http_request_header does not exist)
-- and WARNING log floods caused by missing app.service_role_key GUC settings in pg_cron.
-- Also removes duplicate database indexes.
-- ============================================================================

DO $$
BEGIN
    -- Unschedule problematic cron jobs safely
    PERFORM cron.unschedule('system-automated-backup-check');
    PERFORM cron.unschedule('process-automated-alerts-every-minute');
    PERFORM cron.unschedule('check-break-overtime-job');
    PERFORM cron.unschedule('process-automated-pings-cron');
    PERFORM cron.unschedule('process-email-schedules-cron');
EXCEPTION WHEN OTHERS THEN
    -- Continue if any job doesn't exist
END $$;

-- 1. System Automated Backup Check (Fixed URL & Auth header)
SELECT cron.schedule(
    'system-automated-backup-check',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url:='https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/system-backup-manager',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
        ),
        body:='{}'::jsonb
    );
    $$
);

-- 2. Process Automated Alerts Every Minute (Fixed Auth header, eliminating GUC notices)
SELECT cron.schedule(
    'process-automated-alerts-every-minute',
    '* * * * *',
    $$
    SELECT net.http_post(
        url:='https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/process-notification-rules',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
        ),
        body:='{}'::jsonb,
        timeout_milliseconds:=10000
    );
    $$
);

-- 3. Check Break Overtime Job (Fixed Auth header)
SELECT cron.schedule(
    'check-break-overtime-job',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url:='https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/check-break-overtime',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
        ),
        body:='{}'::jsonb
    );
    $$
);

-- 4. Process Automated Pings Cron (Fixed Auth header)
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
    );
    $$
);

-- 5. Process Email Schedules Cron (Fixed Auth header)
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
    );
    $$
);

-- 6. Clean up duplicate table indexes identified by database linter
DROP INDEX IF EXISTS public.idx_att_events_user_timestamp;
DROP INDEX IF EXISTS public.idx_doc_expiry_employee;
DROP INDEX IF EXISTS public.idx_leave_requests_user_dates2;
DROP INDEX IF EXISTS public.idx_users_org_society;
