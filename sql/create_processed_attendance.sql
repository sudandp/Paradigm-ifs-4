-- ═══════════════════════════════════════════════════════════════════════
--  Paradigm FMS — Enhanced Processed Attendance Table (Supabase)
--  Source: Raw biometric_device_logs punches processed by 7-Rule Engine
--  Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Create or Update Processed Attendance Table ───────────────────────────
CREATE TABLE IF NOT EXISTS public.processed_attendance (
  id               BIGSERIAL PRIMARY KEY,

  -- Employee identity & organization
  emp_code         TEXT NOT NULL,
  emp_name         TEXT,
  department       TEXT,
  designation      TEXT,
  site_id          TEXT,

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
  working_hours    TEXT,

  -- Day status: P, A, W/O, W/P, H, Late, Missed Punch, –, Pending
  status           TEXT NOT NULL DEFAULT 'A',
  status_code      TEXT DEFAULT 'A',

  -- Shift details & Duty Credit
  shift_id         TEXT,
  shift_name       TEXT,
  shift_type       TEXT DEFAULT 'single',      -- 'single' | 'double' | 'split'
  total_duties     NUMERIC(3,1) DEFAULT 1.0,   -- 1.0 (single), 2.0 (double), 0.5 (half)
  shift_completed  BOOLEAN DEFAULT FALSE,
  is_weekly_off    BOOLEAN DEFAULT FALSE,
  is_night_shift   BOOLEAN DEFAULT FALSE,
  is_next_day_out  BOOLEAN DEFAULT FALSE,

  -- Rule Engine Tracking
  rule_applied     TEXT,                       -- 'R1-C_BRIDGE', 'R2-DOUBLE', 'R3-CONFLICT', 'R4-WO', 'R5-WP', 'R6-STITCHED', 'R7-ABSENT', 'MISSED_PUNCH'
  raw_punch_count  INTEGER DEFAULT 0,
  remarks          TEXT,

  -- Source & Audit Trail
  source           TEXT NOT NULL DEFAULT 'device_log', -- 'device_log' | 'manual' | 'mssql'
  processed_by     TEXT DEFAULT 'system',
  processed_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate records per employee per day
  CONSTRAINT uq_processed_attendance UNIQUE (emp_code, attendance_date)
);

-- Non-destructive column additions for existing tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'emp_name') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN emp_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'department') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN department TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'designation') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN designation TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'working_hours') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN working_hours TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'status_code') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN status_code TEXT DEFAULT 'A';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'shift_type') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN shift_type TEXT DEFAULT 'single';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'total_duties') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN total_duties NUMERIC(3,1) DEFAULT 1.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'shift_completed') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN shift_completed BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'is_weekly_off') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN is_weekly_off BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'is_night_shift') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN is_night_shift BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'is_next_day_out') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN is_next_day_out BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'rule_applied') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN rule_applied TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'raw_punch_count') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN raw_punch_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'processed_attendance' AND column_name = 'remarks') THEN
    ALTER TABLE public.processed_attendance ADD COLUMN remarks TEXT;
  END IF;
END $$;

-- ─── 2. Performance Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_proc_att_date
  ON public.processed_attendance (attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_proc_att_emp_date
  ON public.processed_attendance (emp_code, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_proc_att_status
  ON public.processed_attendance (status, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_proc_att_site
  ON public.processed_attendance (site_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_proc_att_shift_type
  ON public.processed_attendance (shift_type);

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
