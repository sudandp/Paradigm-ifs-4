-- ═══════════════════════════════════════════════════════════════════════
--  Paradigm FMS — Attendance Cache Migration
--  Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--  Purpose: Hot cache for MS SQL (eTimeTrackLite) attendance data
--           Current year = always synced (5-min intervals)
--           Previous year = offline fallback cache
--           Older than 1 year = auto-deleted every Jan 1
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Main attendance cache table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_cache (
  id              BIGSERIAL PRIMARY KEY,
  emp_code        TEXT NOT NULL,
  emp_name        TEXT,
  department      TEXT,
  designation     TEXT,
  site            TEXT,
  attendance_date DATE NOT NULL,
  in_time         TEXT,
  out_time        TEXT,
  status          TEXT,
  status_code     TEXT,
  duration_mins   INTEGER DEFAULT 0,
  late_mins       INTEGER DEFAULT 0,
  ot_mins         INTEGER DEFAULT 0,
  working_hours   TEXT,
  shift_completed BOOLEAN DEFAULT FALSE,
  data_year       INTEGER NOT NULL,
  source          TEXT    DEFAULT 'mssql',
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT attendance_cache_emp_date_unique UNIQUE (emp_code, attendance_date)
);

-- ─── 2. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_att_cache_date     ON public.attendance_cache (attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_cache_year     ON public.attendance_cache (data_year);
CREATE INDEX IF NOT EXISTS idx_att_cache_emp      ON public.attendance_cache (emp_code);
CREATE INDEX IF NOT EXISTS idx_att_cache_site_date ON public.attendance_cache (site, attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_cache_status   ON public.attendance_cache (status_code, attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_cache_year_date ON public.attendance_cache (data_year, attendance_date);
-- High-speed composite index for employee calendar/monthly queries (< 5ms scan)
CREATE INDEX IF NOT EXISTS idx_att_cache_emp_date ON public.attendance_cache (emp_code, attendance_date DESC);

-- ─── 3. Sync log table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance_sync_log (
  id               BIGSERIAL PRIMARY KEY,
  sync_date        DATE NOT NULL,
  records_synced   INTEGER DEFAULT 0,
  records_upserted INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'ok',
  error_msg        TEXT,
  duration_ms      INTEGER,
  triggered_by     TEXT DEFAULT 'auto',
  synced_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_date ON public.attendance_sync_log (sync_date DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_synced_at ON public.attendance_sync_log (synced_at DESC);

-- ─── 3b. Sync Log Retention Policy (Purge logs > 30 days to prevent bloat) ───
CREATE OR REPLACE FUNCTION public.prune_old_sync_logs()
RETURNS void LANGUAGE sql AS $$
  DELETE FROM public.attendance_sync_log WHERE synced_at < NOW() - INTERVAL '30 days';
$$;

-- ─── 4. RLS Policies ───────────────────────────────────────────────────────
ALTER TABLE public.attendance_cache    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read attendance_cache" ON public.attendance_cache;
CREATE POLICY "Authenticated read attendance_cache"
  ON public.attendance_cache FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role all attendance_cache" ON public.attendance_cache;
CREATE POLICY "Service role all attendance_cache"
  ON public.attendance_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read sync_log" ON public.attendance_sync_log;
CREATE POLICY "Authenticated read sync_log"
  ON public.attendance_sync_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role all sync_log" ON public.attendance_sync_log;
CREATE POLICY "Service role all sync_log"
  ON public.attendance_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─── 5. Verify ─────────────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('attendance_cache', 'attendance_sync_log');
