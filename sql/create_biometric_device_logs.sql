-- ═══════════════════════════════════════════════════════════════════════
--  Paradigm FMS — Biometric Raw Device Logs & Punch Audit Trail Migration
--  Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Create Raw Biometric Device Logs Table ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.biometric_device_logs (
  id            BIGSERIAL PRIMARY KEY,
  emp_code      TEXT NOT NULL,
  log_date      TIMESTAMPTZ NOT NULL,
  download_date TIMESTAMPTZ,
  device_name   TEXT,
  serial_no     TEXT,
  direction     TEXT,
  verify_mode   TEXT,
  source        TEXT DEFAULT 'etimetracklite',
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Prevents duplicate punches when re-synced
  CONSTRAINT uq_biometric_device_logs UNIQUE (emp_code, log_date)
);

-- ─── 2. High Performance Indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bio_logs_date 
  ON public.biometric_device_logs (log_date DESC);

CREATE INDEX IF NOT EXISTS idx_bio_logs_emp_date 
  ON public.biometric_device_logs (emp_code, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_bio_logs_device 
  ON public.biometric_device_logs (device_name, log_date DESC);

-- ─── 3. Add raw_punches JSONB Column to attendance_cache ────────────────────
-- Allows instant inspection of daily punch timelines without joining heavy tables
ALTER TABLE public.attendance_cache 
  ADD COLUMN IF NOT EXISTS raw_punches JSONB;

-- ─── 4. Row Level Security (RLS) ───────────────────────────────────────────
ALTER TABLE public.biometric_device_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read biometric_device_logs" ON public.biometric_device_logs;
CREATE POLICY "Authenticated read biometric_device_logs"
  ON public.biometric_device_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon read biometric_device_logs" ON public.biometric_device_logs;
CREATE POLICY "Anon read biometric_device_logs"
  ON public.biometric_device_logs FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Service role all biometric_device_logs" ON public.biometric_device_logs;
CREATE POLICY "Service role all biometric_device_logs"
  ON public.biometric_device_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 5. 90-Day Rolling Purge Function & RPC ────────────────────────────────
-- Automatically removes punches older than 90 days to prevent excessive table growth
CREATE OR REPLACE FUNCTION public.purge_old_biometric_device_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.biometric_device_logs
  WHERE log_date < (NOW() - (retention_days || ' days')::INTERVAL);
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
