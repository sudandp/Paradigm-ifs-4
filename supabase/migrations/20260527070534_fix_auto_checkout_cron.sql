-- Fix the auto-checkout cron job by requiring a valid Supabase Anon key
-- Please replace <YOUR_SUPABASE_ANON_KEY> with your project's actual ANON KEY before pushing

SELECT cron.unschedule('auto-checkout-trigger');

SELECT
  cron.schedule(
    'auto-checkout-trigger',
    '30 22 * * *', -- 22:30 UTC = 04:00 IST the next day
    $$
    select
      net.http_post(
          url:='https://gofofbmtvlluquokstfz.supabase.co/functions/v1/trigger-missed-checkouts',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_SUPABASE_ANON_KEY>"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
  );