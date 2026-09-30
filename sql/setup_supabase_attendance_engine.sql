-- ═══════════════════════════════════════════════════════════════════════
--  Paradigm FMS — All-In-One Supabase Attendance Engine Setup
--  Run this ONCE in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
--
--  Includes:
--    Part 1: Dynamic Staff Weekly Off Roster (staff_weekly_off + 17 HK staff seed)
--    Part 2: Enhanced Processed Attendance Table (processed_attendance + indexes + RLS)
--    Part 3: 7-Rule Attendance Processing Engine RPC (process_daily_attendance)
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
--  PART 1: STAFF WEEKLY OFF MASTER TABLE & ROSTER SEED
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_weekly_off (
  id              BIGSERIAL PRIMARY KEY,
  emp_code        TEXT NOT NULL UNIQUE,
  staff_name      TEXT NOT NULL,
  weekly_off_day  SMALLINT NOT NULL,        -- 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  weekly_off_day2 SMALLINT NULL,           -- Optional 2nd off day (e.g. Manohar: Mon + Wed)
  effective_from  DATE NOT NULL DEFAULT '2026-09-01',
  department      TEXT DEFAULT 'Housekeeping',
  site            TEXT DEFAULT 'Brigade Cornerstone Utopia',
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_wo_emp ON public.staff_weekly_off (emp_code);

ALTER TABLE public.staff_weekly_off ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read staff_weekly_off" ON public.staff_weekly_off;
CREATE POLICY "Public read staff_weekly_off" ON public.staff_weekly_off FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role all staff_weekly_off" ON public.staff_weekly_off;
CREATE POLICY "Service role all staff_weekly_off" ON public.staff_weekly_off FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed all 17 Housekeeping staff with their authentic rotational weekly off days
INSERT INTO public.staff_weekly_off (emp_code, staff_name, weekly_off_day, weekly_off_day2, remarks)
VALUES
  ('31056', 'Goutam',               4, NULL, 'Thursday W/O (Sep 3, 10, 17, 24)'),
  ('31099', 'Swadhin Malik',        2, NULL, 'Tuesday W/O (Sep 1, 8, 15, 22)'),
  ('31104', 'Amit Kumar Biswal',    4, NULL, 'Thursday W/O (Sep 3, 10, 17, 24)'),
  ('31103', 'Anand',                5, NULL, 'Friday W/O (Sep 4, 11, 18, 25)'),
  ('31034', 'Prashant M',           5, NULL, 'Friday W/O (Sep 4, 11, 18, 25)'),
  ('31011', 'Sathish Kumar',        3, NULL, 'Wednesday W/O (Sep 2, 9, 16, 23)'),
  ('31008', 'Satyaranjan Barik',    3, NULL, 'Wednesday W/O (Sep 2, 9, 16, 23)'),
  ('31116', 'Shridhar',             3, NULL, 'Wednesday W/O (Sep 2, 9, 16, 23)'),
  ('31107', 'Devaraj',              6, NULL, 'Saturday W/O (Sep 5, 12, 19, 26)'),
  ('31010', 'Manohar',              1, 3,    'Monday + Wednesday W/O (Dual W/O)'),
  ('31091', 'Pradip Malik',         3, NULL, 'Wednesday W/O (Sep 2, 9, 16, 23)'),
  ('31049', 'Bir Bahadhur Rawal',   1, NULL, 'Monday W/O (Sep 7, 14, 21, 28)'),
  ('31102', 'Sarbeshwar Rout',      6, NULL, 'Saturday W/O (Sep 5, 12, 19, 26)'),
  ('31015', 'Chandrappa',           2, NULL, 'Tuesday W/O (Sep 1, 8, 15, 22)'),
  ('31007', 'Chinmaya Barik',       1, NULL, 'Monday W/O (Sep 7, 14, 21, 28)'),
  ('31016', 'Manjunath',            0, NULL, 'Sunday W/O (Sep 6, 13, 20, 27)'),
  ('31020', 'Basavana Gowda',       0, NULL, 'Sunday W/O (Sep 6, 13, 20, 27)')
ON CONFLICT (emp_code) DO UPDATE SET
  weekly_off_day  = EXCLUDED.weekly_off_day,
  weekly_off_day2 = EXCLUDED.weekly_off_day2,
  remarks         = EXCLUDED.remarks,
  updated_at      = NOW();


-- ─────────────────────────────────────────────────────────────────────
--  PART 2: PROCESSED ATTENDANCE TABLE & INDEXES
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.processed_attendance (
  id               BIGSERIAL PRIMARY KEY,
  emp_code         TEXT NOT NULL,
  emp_name         TEXT,
  department       TEXT,
  designation      TEXT,
  site_id          TEXT,
  attendance_date  DATE NOT NULL,
  in_time          TEXT,
  out_time         TEXT,
  gross_mins       INTEGER DEFAULT 0,
  net_mins         INTEGER DEFAULT 0,
  ot_mins          INTEGER DEFAULT 0,
  late_minutes     INTEGER DEFAULT 0,
  early_exit_mins  INTEGER DEFAULT 0,
  working_hours    TEXT,
  status           TEXT NOT NULL DEFAULT 'A',
  status_code      TEXT DEFAULT 'A',
  shift_id         TEXT,
  shift_name       TEXT,
  shift_type       TEXT DEFAULT 'single',      -- 'single' | 'double' | 'split'
  total_duties     NUMERIC(3,1) DEFAULT 1.0,   -- 1.0 (standard), 2.0 (double), 0.5 (half)
  shift_completed  BOOLEAN DEFAULT FALSE,
  is_weekly_off    BOOLEAN DEFAULT FALSE,
  is_night_shift   BOOLEAN DEFAULT FALSE,
  is_next_day_out  BOOLEAN DEFAULT FALSE,
  rule_applied     TEXT,                       -- 'R1-C_BRIDGE', 'R2-DOUBLE', 'R3-CONFLICT', 'R4-WO', 'R5-WP', 'R6-STITCHED', 'R7-ABSENT', 'MISSED_PUNCH'
  raw_punch_count  INTEGER DEFAULT 0,
  remarks          TEXT,
  source           TEXT NOT NULL DEFAULT 'device_log',
  processed_by     TEXT DEFAULT 'system',
  processed_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
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

CREATE INDEX IF NOT EXISTS idx_proc_att_date       ON public.processed_attendance (attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_proc_att_emp_date   ON public.processed_attendance (emp_code, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_proc_att_status     ON public.processed_attendance (status, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_proc_att_site       ON public.processed_attendance (site_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_proc_att_shift_type ON public.processed_attendance (shift_type);

-- Auto-update trigger for updated_at
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

-- RLS Policies
ALTER TABLE public.processed_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read processed_attendance" ON public.processed_attendance;
CREATE POLICY "Authenticated read processed_attendance" ON public.processed_attendance FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon read processed_attendance" ON public.processed_attendance;
CREATE POLICY "Anon read processed_attendance" ON public.processed_attendance FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Service role all processed_attendance" ON public.processed_attendance;
CREATE POLICY "Service role all processed_attendance" ON public.processed_attendance FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated insert processed_attendance" ON public.processed_attendance;
CREATE POLICY "Authenticated insert processed_attendance" ON public.processed_attendance FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update processed_attendance" ON public.processed_attendance;
CREATE POLICY "Authenticated update processed_attendance" ON public.processed_attendance FOR UPDATE TO authenticated USING (true);


-- ─────────────────────────────────────────────────────────────────────
--  PART 3: NATIVE 7-RULE ATTENDANCE PROCESSING RPC FUNCTION
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.process_daily_attendance(
  p_from_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day',
  p_to_date   DATE DEFAULT CURRENT_DATE,
  p_emp_code  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec_count INT := 0;
  v_p_count   INT := 0;
  v_wp_count  INT := 0;
  v_dbl_count INT := 0;
  v_mp_count  INT := 0;
BEGIN

  -- 1. Create temporary table of chronologically sorted, debounced punches
  CREATE TEMP TABLE temp_clean_punches ON COMMIT DROP AS
  WITH raw_pool AS (
    SELECT
      emp_code,
      log_date::timestamptz AT TIME ZONE 'Asia/Kolkata' AS punch_time,
      (log_date::timestamptz AT TIME ZONE 'Asia/Kolkata')::date AS punch_date,
      EXTRACT(HOUR FROM (log_date::timestamptz AT TIME ZONE 'Asia/Kolkata'))::int AS punch_hour,
      EXTRACT(MINUTE FROM (log_date::timestamptz AT TIME ZONE 'Asia/Kolkata'))::int AS punch_min,
      TO_CHAR(log_date::timestamptz AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS hhmm,
      device_name
    FROM public.biometric_device_logs
    WHERE (log_date::timestamptz AT TIME ZONE 'Asia/Kolkata')::date >= p_from_date
      AND (log_date::timestamptz AT TIME ZONE 'Asia/Kolkata')::date <= p_to_date + 1
      AND (p_emp_code IS NULL OR emp_code = p_emp_code)
  ),
  debounced AS (
    SELECT
      emp_code,
      punch_time,
      punch_date,
      punch_hour,
      punch_min,
      hhmm,
      device_name,
      LAG(punch_time) OVER (PARTITION BY emp_code ORDER BY punch_time) AS prev_time
    FROM raw_pool
  )
  SELECT
    emp_code,
    punch_time,
    punch_date,
    punch_hour,
    punch_min,
    hhmm,
    device_name,
    ROW_NUMBER() OVER (PARTITION BY emp_code, punch_date ORDER BY punch_time ASC)  AS punch_asc,
    ROW_NUMBER() OVER (PARTITION BY emp_code, punch_date ORDER BY punch_time DESC) AS punch_desc
  FROM debounced
  WHERE prev_time IS NULL OR punch_time - prev_time >= INTERVAL '60 seconds';

  -- 2. Process attendance records per employee per target date
  WITH target_dates AS (
    SELECT d::date AS att_date
    FROM generate_series(p_from_date::timestamp, p_to_date::timestamp, '1 day'::interval) d
  ),
  active_employees AS (
    SELECT DISTINCT emp_code FROM temp_clean_punches
    UNION
    SELECT emp_code FROM public.staff_weekly_off
    WHERE p_emp_code IS NULL OR emp_code = p_emp_code
  ),
  calendar_grid AS (
    SELECT
      e.emp_code,
      d.att_date,
      EXTRACT(DOW FROM d.att_date)::int AS day_of_week
    FROM active_employees e
    CROSS JOIN target_dates d
  ),
  punches_today AS (
    SELECT
      g.emp_code,
      g.att_date,
      g.day_of_week,
      MIN(p.punch_time) AS first_punch_time,
      MIN(p.hhmm) FILTER (WHERE p.punch_asc = 1) AS first_punch_hhmm,
      MIN(p.punch_hour) FILTER (WHERE p.punch_asc = 1) AS first_punch_hour,
      MAX(p.punch_time) AS last_punch_time,
      MAX(p.hhmm) FILTER (WHERE p.punch_desc = 1) AS last_punch_hhmm,
      MAX(p.punch_hour) FILTER (WHERE p.punch_desc = 1) AS last_punch_hour,
      MIN(p.punch_time) FILTER (WHERE p.punch_hour >= 19) AS evening_punch_time,
      MIN(p.hhmm) FILTER (WHERE p.punch_hour >= 19) AS evening_punch_hhmm,
      COUNT(p.punch_time) AS punch_count
    FROM calendar_grid g
    LEFT JOIN temp_clean_punches p
      ON g.emp_code = p.emp_code AND g.att_date = p.punch_date
    GROUP BY g.emp_code, g.att_date, g.day_of_week
  ),
  punches_next_morning AS (
    SELECT
      p.emp_code,
      (p.punch_date - 1)::date AS prev_att_date,
      MAX(p.punch_time) AS next_out_time,
      MAX(p.hhmm)       AS next_out_hhmm
    FROM temp_clean_punches p
    WHERE p.punch_hour < 9 OR (p.punch_hour = 9 AND p.punch_min <= 30)
    GROUP BY p.emp_code, (p.punch_date - 1)::date
  ),
  roster_info AS (
    SELECT
      w.emp_code,
      w.staff_name,
      w.department,
      w.weekly_off_day,
      w.weekly_off_day2
    FROM public.staff_weekly_off w
  ),
  stitching_candidates AS (
    SELECT
      t.emp_code,
      r.staff_name,
      r.department,
      t.att_date,
      t.day_of_week,
      t.punch_count,
      CASE
        WHEN r.weekly_off_day = t.day_of_week OR r.weekly_off_day2 = t.day_of_week THEN true
        ELSE false
      END AS is_weekly_off_day,
      CASE
        WHEN t.evening_punch_time IS NOT NULL AND nm.next_out_time IS NOT NULL THEN true
        ELSE false
      END AS is_night_stitched,
      CASE
        WHEN t.first_punch_hour < 11 AND t.last_punch_hour >= 19
          AND EXTRACT(EPOCH FROM (t.last_punch_time - t.first_punch_time)) >= 41400 THEN 'double_ab'
        WHEN t.evening_punch_time IS NOT NULL AND nm.next_out_time IS NOT NULL
          AND t.first_punch_hour >= 12 AND t.first_punch_hour < 17 THEN 'double_bc'
        ELSE 'single'
      END AS resolved_shift_type,
      t.first_punch_time,
      t.first_punch_hhmm,
      t.last_punch_time,
      t.last_punch_hhmm,
      t.evening_punch_time,
      t.evening_punch_hhmm,
      nm.next_out_time,
      nm.next_out_hhmm
    FROM punches_today t
    LEFT JOIN punches_next_morning nm
      ON t.emp_code = nm.emp_code AND t.att_date = nm.prev_att_date
    LEFT JOIN roster_info r
      ON t.emp_code = r.emp_code
  ),
  evaluated_records AS (
    SELECT
      c.emp_code,
      c.staff_name,
      c.department,
      c.att_date AS attendance_date,
      CASE
        WHEN c.is_night_stitched THEN c.evening_punch_hhmm
        WHEN c.punch_count >= 1 THEN c.first_punch_hhmm
        ELSE NULL
      END AS in_time,
      CASE
        WHEN c.is_night_stitched THEN c.next_out_hhmm
        WHEN c.punch_count >= 2 THEN c.last_punch_hhmm
        ELSE NULL
      END AS out_time,
      CASE
        WHEN c.is_night_stitched THEN
          ROUND(EXTRACT(EPOCH FROM (c.next_out_time - c.evening_punch_time)) / 60.0)::int
        WHEN c.punch_count >= 2 THEN
          ROUND(EXTRACT(EPOCH FROM (c.last_punch_time - c.first_punch_time)) / 60.0)::int
        ELSE 0
      END AS gross_mins,
      c.resolved_shift_type,
      c.is_weekly_off_day,
      c.is_night_stitched,
      c.punch_count
    FROM stitching_candidates c
  ),
  final_attendance AS (
    SELECT
      e.emp_code,
      e.staff_name,
      e.department,
      e.attendance_date,
      e.in_time,
      e.out_time,
      e.gross_mins,
      GREATEST(0, e.gross_mins - CASE WHEN e.resolved_shift_type != 'single' THEN 60 WHEN e.gross_mins >= 60 THEN 30 ELSE 0 END) AS net_mins,
      GREATEST(0,
        GREATEST(0, e.gross_mins - CASE WHEN e.resolved_shift_type != 'single' THEN 60 WHEN e.gross_mins >= 60 THEN 30 ELSE 0 END) -
        (CASE WHEN e.resolved_shift_type != 'single' THEN 16 ELSE 9 END * 60)
      ) AS ot_mins,
      CASE
        WHEN e.resolved_shift_type != 'single' THEN 2.0
        WHEN e.gross_mins >= 180 OR (e.in_time IS NOT NULL AND e.out_time IS NOT NULL) THEN 1.0
        WHEN e.in_time IS NOT NULL AND e.out_time IS NULL THEN 0.5
        ELSE 0.0
      END AS total_duties,
      CASE
        WHEN e.is_weekly_off_day AND e.gross_mins >= 180 THEN 'W/P'
        WHEN e.is_weekly_off_day AND e.gross_mins < 180 THEN 'W/O'
        WHEN e.in_time IS NOT NULL AND e.out_time IS NULL THEN 'Missed Punch'
        WHEN e.gross_mins >= 180 THEN 'P'
        ELSE 'A'
      END AS status,
      CASE
        WHEN e.is_weekly_off_day AND e.gross_mins >= 180 THEN 'WP'
        WHEN e.is_weekly_off_day AND e.gross_mins < 180 THEN 'WO'
        WHEN e.in_time IS NOT NULL AND e.out_time IS NULL THEN 'MP'
        WHEN e.gross_mins >= 180 THEN 'P'
        ELSE 'A'
      END AS status_code,
      CASE
        WHEN e.resolved_shift_type != 'single' THEN 'Double Shift'
        WHEN e.is_night_stitched THEN 'Shift C (Night)'
        ELSE 'General'
      END AS shift_name,
      e.resolved_shift_type AS shift_type,
      e.is_weekly_off_day   AS is_weekly_off,
      e.is_night_stitched   AS is_night_shift,
      e.is_night_stitched   AS is_next_day_out,
      (e.gross_mins >= 360) AS shift_completed,
      CASE
        WHEN e.is_weekly_off_day AND e.gross_mins >= 180 THEN 'R5-WP'
        WHEN e.is_weekly_off_day AND e.gross_mins < 180 THEN 'R4-ROSTER_WO'
        WHEN e.resolved_shift_type = 'double_ab' THEN 'R2-DOUBLE_AB'
        WHEN e.resolved_shift_type = 'double_bc' THEN 'R2-DOUBLE_BC'
        WHEN e.is_night_stitched THEN 'R1-C_BRIDGE'
        WHEN e.in_time IS NOT NULL AND e.out_time IS NULL THEN 'MISSED_PUNCH'
        WHEN e.gross_mins >= 180 THEN 'STANDARD'
        ELSE 'R7-ABSENT'
      END AS rule_applied,
      e.punch_count AS raw_punch_count
    FROM evaluated_records e
  )
  INSERT INTO public.processed_attendance (
    emp_code,
    emp_name,
    department,
    attendance_date,
    in_time,
    out_time,
    gross_mins,
    net_mins,
    ot_mins,
    working_hours,
    status,
    status_code,
    shift_name,
    shift_type,
    total_duties,
    shift_completed,
    is_weekly_off,
    is_night_shift,
    is_next_day_out,
    rule_applied,
    raw_punch_count,
    source,
    processed_by,
    processed_at
  )
  SELECT
    fa.emp_code,
    fa.staff_name,
    fa.department,
    fa.attendance_date,
    fa.in_time,
    fa.out_time,
    fa.gross_mins,
    fa.net_mins,
    fa.ot_mins,
    CASE
      WHEN fa.net_mins > 0 THEN (fa.net_mins / 60)::text || 'h ' || LPAD((fa.net_mins % 60)::text, 2, '0') || 'm'
      ELSE '—'
    END AS working_hours,
    fa.status,
    fa.status_code,
    fa.shift_name,
    fa.shift_type,
    fa.total_duties,
    fa.shift_completed,
    fa.is_weekly_off,
    fa.is_night_shift,
    fa.is_next_day_out,
    fa.rule_applied,
    fa.raw_punch_count,
    'postgres_engine',
    'system_rpc',
    NOW()
  FROM final_attendance fa
  ON CONFLICT (emp_code, attendance_date) DO UPDATE SET
    emp_name        = EXCLUDED.emp_name,
    department      = EXCLUDED.department,
    in_time         = EXCLUDED.in_time,
    out_time        = EXCLUDED.out_time,
    gross_mins      = EXCLUDED.gross_mins,
    net_mins        = EXCLUDED.net_mins,
    ot_mins         = EXCLUDED.ot_mins,
    working_hours   = EXCLUDED.working_hours,
    status          = EXCLUDED.status,
    status_code     = EXCLUDED.status_code,
    shift_name      = EXCLUDED.shift_name,
    shift_type      = EXCLUDED.shift_type,
    total_duties    = EXCLUDED.total_duties,
    shift_completed = EXCLUDED.shift_completed,
    is_weekly_off   = EXCLUDED.is_weekly_off,
    is_night_shift  = EXCLUDED.is_night_shift,
    is_next_day_out = EXCLUDED.is_next_day_out,
    rule_applied    = EXCLUDED.rule_applied,
    raw_punch_count = EXCLUDED.raw_punch_count,
    updated_at      = NOW();

  GET DIAGNOSTICS v_rec_count = ROW_COUNT;

  SELECT
    COUNT(*) FILTER (WHERE status = 'P'),
    COUNT(*) FILTER (WHERE status = 'W/P'),
    COUNT(*) FILTER (WHERE shift_type != 'single'),
    COUNT(*) FILTER (WHERE status = 'Missed Punch')
  INTO v_p_count, v_wp_count, v_dbl_count, v_mp_count
  FROM public.processed_attendance
  WHERE attendance_date BETWEEN p_from_date AND p_to_date
    AND (p_emp_code IS NULL OR emp_code = p_emp_code);

  RETURN jsonb_build_object(
    'success', true,
    'from_date', p_from_date,
    'to_date', p_to_date,
    'upserted_records', v_rec_count,
    'present_days', v_p_count,
    'weekly_off_worked', v_wp_count,
    'double_shifts', v_dbl_count,
    'missed_punches', v_mp_count
  );
END;
$$;
