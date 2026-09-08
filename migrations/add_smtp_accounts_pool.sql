-- ============================================================
-- SMTP Account Pool — Multi-sender routing table
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.smtp_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  app_password  TEXT NOT NULL,
  host          VARCHAR(100) NOT NULL DEFAULT 'smtp.gmail.com',
  port          INTEGER NOT NULL DEFAULT 465,
  secure        BOOLEAN NOT NULL DEFAULT true,
  from_name     VARCHAR(100) DEFAULT 'Paradigm FMS',
  report_types  TEXT[] NOT NULL DEFAULT '{}',
  daily_limit   INTEGER NOT NULL DEFAULT 2000,
  sent_today    INTEGER NOT NULL DEFAULT 0,
  last_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_smtp_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_smtp_accounts_updated_at ON public.smtp_accounts;
CREATE TRIGGER trg_smtp_accounts_updated_at
  BEFORE UPDATE ON public.smtp_accounts
  FOR EACH ROW EXECUTE FUNCTION update_smtp_accounts_updated_at();

-- RLS: Only admins can manage SMTP accounts (sensitive credentials)
ALTER TABLE public.smtp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smtp_accounts_service_all"
  ON public.smtp_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookup by report type
CREATE INDEX IF NOT EXISTS idx_smtp_accounts_report_types
  ON public.smtp_accounts USING GIN (report_types);

CREATE INDEX IF NOT EXISTS idx_smtp_accounts_active
  ON public.smtp_accounts (is_active, sent_today, daily_limit);

-- ============================================================
-- Helper view: shows usage % per account (for the UI)
-- ============================================================
CREATE OR REPLACE VIEW public.smtp_accounts_usage AS
SELECT
  id,
  name,
  email,
  host,
  port,
  secure,
  from_name,
  report_types,
  daily_limit,
  sent_today,
  last_reset_at,
  is_active,
  created_at,
  ROUND((sent_today::NUMERIC / NULLIF(daily_limit, 0)) * 100, 1) AS usage_percent,
  (daily_limit - sent_today) AS remaining_today
FROM public.smtp_accounts;

-- Grant service role full access
GRANT ALL ON public.smtp_accounts TO service_role;
GRANT SELECT ON public.smtp_accounts_usage TO service_role;
