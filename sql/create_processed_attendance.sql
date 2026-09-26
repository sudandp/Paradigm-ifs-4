-- ═══════════════════════════════════════════════════════════════════════
--  Paradigm FMS — Processed Attendance Table
--  Source: Raw biometric_device_logs punches processed by deviceLogProcessor
--  Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Create Processed Attendance Table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.processed_attendance (
  id               BIGSERIAL PRIMARY KEY,

  -- Employee identifier (matches emp_code in biometric_device_logs)
  emp_code         TEXT NOT NULL,

  -- Calendar date this record applies to (always YYYY-MM-DD, no time component)
  attendance_date  DATE NOT NULL,

  -- Punch times as stored strings (e.g. '09:05', '18:42')
  in_time          TEXT,
  out_time         TEXT,

  -- Duration metrics (all in minutes)
  gross_mins       INTEGER DEFAULT 0,
  net_mins         INTEGER DEFAULT 0,
  ot_mins          INTEGER DEFAULT 0,
  late_minutes     INTEGER DEFAULT 0,
  early_exit_mins  INTEGER DEFAULT 0,

  -- Day status: P, A, W/O, H, Late, –, Pending
  status           TEXT NOT NULL DEFAULT 'A',

  -- Shift that was assigned / auto-detected
  shift_id         TEXT,
  shift_name       TEXT,

  -- Site/location context
  site_id          TEXT,

  -- Source of data: 'device_log' | 'manual' | 'mssql'
  source           TEXT NOT NULL DEFAULT 'device_log',

  -- Who triggered the processing
  processed_by     TEXT,
  processed_at     TIMESTAMPTZ DEFAULT NOW(),

  -- Audit trail
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate records per employee per day per source
  CONSTRAINT uq_processed_attendance UNIQUE (emp_code, attendance_date)
);

-- ─── 2. Performance Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proc_att_date
  ON public.processed_attendance (attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_proc_att_emp_date
  ON public.processed_attendance (emp_code, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_proc_att_status
  ON public.processed_attendance (status, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_proc_att_site
  ON public.processed_attendance (site_id, attendance_date DESC);

-- ─── 3. Auto-update updated_at on every write ────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_processed_attendance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proc_att_updated_at ON public.processed_attendance;
CREATE TRIGGER trg_proc_att_updated_at
  BEFORE UPDATE ON public.processed_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_processed_attendance_updated_at();

-- ─── 4. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.processed_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read processed_attendance" ON public.processed_attendance;
CREATE POLICY "Authenticated read processed_attendance"
  ON public.processed_attendance FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon read processed_attendance" ON public.processed_attendance;
CREATE POLICY "Anon read processed_attendance"
  ON public.processed_attendance FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Service role all processed_attendance" ON public.processed_attendance;
CREATE POLICY "Service role all processed_attendance"
  ON public.processed_attendance FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated insert processed_attendance" ON public.processed_attendance;
CREATE POLICY "Authenticated insert processed_attendance"
  ON public.processed_attendance FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update processed_attendance" ON public.processed_attendance;
CREATE POLICY "Authenticated update processed_attendance"
  ON public.processed_attendance FOR UPDATE TO authenticated USING (true);

-- ─── 5. Summary RPC (used by dashboard for quick stats) ─────────────────────
CREATE OR REPLACE FUNCTION public.get_processed_attendance_summary(
  p_emp_code   TEXT,
  p_from_date  DATE,
  p_to_date    DATE
)
RETURNS TABLE(
  attendance_date DATE,
  in_time         TEXT,
  out_time        TEXT,
  net_mins        INTEGER,
  ot_mins         INTEGER,
  late_minutes    INTEGER,
  status          TEXT,
  shift_name      TEXT,
  source          TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    pa.attendance_date,
    pa.in_time,
    pa.out_time,
    pa.net_mins,
    pa.ot_mins,
    pa.late_minutes,
    pa.status,
    pa.shift_name,
    pa.source
  FROM public.processed_attendance pa
  WHERE pa.emp_code = p_emp_code
    AND pa.attendance_date BETWEEN p_from_date AND p_to_date
  ORDER BY pa.attendance_date ASC;
$$;
