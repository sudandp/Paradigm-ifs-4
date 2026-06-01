CREATE TABLE api_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hr_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast counting
CREATE INDEX idx_rate_limits_user_time ON api_rate_limits(hr_user_id, created_at);


SELECT cron.schedule(
  'purge-old-rate-limits',
  '0 * * * *',
  $$
  DELETE FROM api_rate_limits 
  WHERE created_at < NOW() - INTERVAL '2 hours';
  $$
);
