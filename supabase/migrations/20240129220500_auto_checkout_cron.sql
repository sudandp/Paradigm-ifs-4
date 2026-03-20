
-- Enable pg_cron extension if not already enabled
create extension if not exists pg_cron;

-- Schedule the cron job to run every 15 minutes
-- This ensures that if the user changes the checkout time, the system will pick it up within 15 minutes of the new time.
-- NOTE: You must replace <SUPABASE_ANON_KEY> with your actual Anon Key before running this.
select cron.schedule(
  'auto-checkout-trigger', -- Job name
  '*/15 * * * *',          -- Schedule: Every 15 minutes
  $$
  select
    net.http_post(
        url:='https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/trigger-missed-checkouts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SUPABASE_ANON_KEY>"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
