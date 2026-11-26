-- ============================================================================
-- Cron: run helpdesk-process-inbound every minute (retries + draft expiry).
-- Secrets are read from Supabase Vault at run time — nothing sensitive in git.
--
-- One-time setup (SQL editor), before or after this migration:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random-long-string>', 'helpdesk_cron_secret');
-- and set the same value as the function secret:
--   supabase secrets set HELPDESK_CRON_SECRET=<random-long-string>
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
    PERFORM cron.unschedule('helpdesk-process-inbound-every-minute');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
    'helpdesk-process-inbound-every-minute',
    '* * * * *',
    $cron$
    SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/helpdesk-process-inbound',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'helpdesk_cron_secret')
        ),
        body := '{}'::jsonb
    )
    WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'helpdesk_cron_secret');
    $cron$
);
