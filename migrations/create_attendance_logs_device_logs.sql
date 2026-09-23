-- ============================================================
-- Supabase Migration: Attendance Logs + Device Logs
-- Project : fmyafuhxlorbafbacywa
-- Created : 2026-09-23
-- Safe     : All statements use IF NOT EXISTS — idempotent
-- ============================================================

-- ============================================================
-- TABLE 1: public.device_logs
-- Raw biometric punches (mirrors eTimeTrackLite DeviceLogs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.device_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date    TIMESTAMPTZ NOT NULL,
  direction   TEXT        NOT NULL CHECK (direction IN ('In', 'Out')),
  device_id   INTEGER     DEFAULT 1,
  source      TEXT        DEFAULT 'manual' CHECK (source IN ('biometric', 'manual', 'app', 'excel')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_logs_user_id   ON public.device_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_device_logs_log_date  ON public.device_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_device_logs_direction ON public.device_logs(direction);

-- RLS
ALTER TABLE public.device_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_logs_select_own"  ON public.device_logs;
DROP POLICY IF EXISTS "device_logs_select_admin" ON public.device_logs;
DROP POLICY IF EXISTS "device_logs_insert_admin" ON public.device_logs;

-- Users can see their own logs
CREATE POLICY "device_logs_select_own" ON public.device_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Admins / HR / Reporting can see all
CREATE POLICY "device_logs_select_admin" ON public.device_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role_id IN ('admin', 'hr', 'reporting', 'management')
    )
  );

-- Only admins / HR / service role can insert
CREATE POLICY "device_logs_insert_admin" ON public.device_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role_id IN ('admin', 'hr')
    )
  );


-- ============================================================
-- TABLE 2: public.attendance_logs
-- Daily attendance summary (mirrors eTimeTrackLite AttendanceLogs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attendance_date  DATE        NOT NULL,

  -- Punch times
  in_time          TIMESTAMPTZ,
  out_time         TIMESTAMPTZ,
  duration         INTEGER     DEFAULT 0,   -- Net working minutes (break excluded)

  -- Status
  status           TEXT        DEFAULT 'Absent'
                   CHECK (status IN ('Present', 'Absent', 'WeekOff', 'Holiday', 'Leave', 'HalfDay')),
  status_code      TEXT        DEFAULT 'A'
                   CHECK (status_code IN ('P', 'A', 'WO', 'H', 'L', 'HD')),
  p1_status        TEXT        DEFAULT 'A',

  -- Flags
  present          NUMERIC(3,1) DEFAULT 0.0,
  absent           NUMERIC(3,1) DEFAULT 1.0,
  weekly_off       INTEGER      DEFAULT 0,
  is_on_leave      INTEGER      DEFAULT 0,
  holiday          INTEGER      DEFAULT 0,

  -- Timing deviations (minutes)
  late_by          INTEGER      DEFAULT 0,
  early_by         INTEGER      DEFAULT 0,
  overtime         INTEGER      DEFAULT 0,
  overtime_e       INTEGER      DEFAULT 0,

  -- Punch completeness
  missed_out_punch INTEGER      DEFAULT 0,
  missed_in_punch  INTEGER      DEFAULT 0,

  -- Meta
  shift_id         INTEGER      DEFAULT 1,
  source           TEXT         DEFAULT 'app'
                   CHECK (source IN ('app', 'biometric', 'manual', 'excel')),
  remarks          TEXT,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW(),

  -- One row per user per day
  CONSTRAINT uq_attendance_logs_user_date UNIQUE (user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_att_logs_user_id        ON public.attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_att_logs_date           ON public.attendance_logs(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_att_logs_status         ON public.attendance_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_att_logs_user_date      ON public.attendance_logs(user_id, attendance_date);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attendance_logs_updated_at ON public.attendance_logs;
CREATE TRIGGER trg_attendance_logs_updated_at
  BEFORE UPDATE ON public.attendance_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "att_logs_select_own"   ON public.attendance_logs;
DROP POLICY IF EXISTS "att_logs_select_admin" ON public.attendance_logs;
DROP POLICY IF EXISTS "att_logs_insert_admin" ON public.attendance_logs;
DROP POLICY IF EXISTS "att_logs_update_admin" ON public.attendance_logs;

-- Users see their own records
CREATE POLICY "att_logs_select_own" ON public.attendance_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Admins / HR / Reporting see all
CREATE POLICY "att_logs_select_admin" ON public.attendance_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role_id IN ('admin', 'hr', 'reporting', 'management')
    )
  );

-- Admins / HR can insert
CREATE POLICY "att_logs_insert_admin" ON public.attendance_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role_id IN ('admin', 'hr')
    )
  );

-- Admins / HR can update
CREATE POLICY "att_logs_update_admin" ON public.attendance_logs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role_id IN ('admin', 'hr')
    )
  );


-- ============================================================
-- HELPER RPC: get_attendance_summary
-- Returns daily records for a user between two dates
-- Usage: SELECT * FROM get_attendance_summary('uuid', '2026-09-01', '2026-09-30');
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_attendance_summary(
  p_user_id UUID,
  p_start   DATE,
  p_end     DATE
)
RETURNS TABLE (
  attendance_date  DATE,
  in_time          TIMESTAMPTZ,
  out_time         TIMESTAMPTZ,
  duration         INTEGER,
  status           TEXT,
  status_code      TEXT,
  missed_out_punch INTEGER,
  holiday          INTEGER,
  weekly_off       INTEGER,
  remarks          TEXT
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    attendance_date,
    in_time,
    out_time,
    duration,
    status,
    status_code,
    missed_out_punch,
    holiday,
    weekly_off,
    remarks
  FROM public.attendance_logs
  WHERE user_id = p_user_id
    AND attendance_date BETWEEN p_start AND p_end
  ORDER BY attendance_date;
$$;


-- ============================================================
-- MANUAL ENTRY: noronhasanup@gmail.com  |  Sep 9–15, 2026
-- ============================================================
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Resolve user
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'noronhasanup@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: noronhasanup@gmail.com';
  END IF;

  -- ── Device Logs (raw punches) ───────────────────────────────

  -- 09-Sep-2026
  INSERT INTO public.device_logs (user_id, log_date, direction, source, notes)
  VALUES
    (v_user_id, '2026-09-09 09:35:00+05:30', 'In',  'excel', 'Excel Verified'),
    (v_user_id, '2026-09-09 14:15:00+05:30', 'Out', 'excel', 'Break Out'),
    (v_user_id, '2026-09-09 14:35:00+05:30', 'In',  'excel', 'Break In'),
    (v_user_id, '2026-09-09 18:10:00+05:30', 'Out', 'excel', 'Excel Verified');

  -- 10-Sep-2026
  INSERT INTO public.device_logs (user_id, log_date, direction, source, notes)
  VALUES
    (v_user_id, '2026-09-10 09:05:00+05:30', 'In',  'excel', 'Excel Verified'),
    (v_user_id, '2026-09-10 14:05:00+05:30', 'Out', 'excel', 'Break Out'),
    (v_user_id, '2026-09-10 14:20:00+05:30', 'In',  'excel', 'Break In'),
    (v_user_id, '2026-09-10 19:00:00+05:30', 'Out', 'excel', 'Excel Verified');

  -- 11-Sep-2026
  INSERT INTO public.device_logs (user_id, log_date, direction, source, notes)
  VALUES
    (v_user_id, '2026-09-11 09:15:00+05:30', 'In',  'excel', 'Excel Verified'),
    (v_user_id, '2026-09-11 13:55:00+05:30', 'Out', 'excel', 'Break Out'),
    (v_user_id, '2026-09-11 14:15:00+05:30', 'In',  'excel', 'Break In'),
    (v_user_id, '2026-09-11 19:20:00+05:30', 'Out', 'excel', 'Excel Verified');

  -- 12-Sep-2026
  INSERT INTO public.device_logs (user_id, log_date, direction, source, notes)
  VALUES
    (v_user_id, '2026-09-12 09:25:00+05:30', 'In',  'excel', 'Excel Verified'),
    (v_user_id, '2026-09-12 14:05:00+05:30', 'Out', 'excel', 'Break Out'),
    (v_user_id, '2026-09-12 14:35:00+05:30', 'In',  'excel', 'Break In'),
    (v_user_id, '2026-09-12 19:35:00+05:30', 'Out', 'excel', 'Excel Verified');

  -- 15-Sep-2026 (In only — app configured, Out missing)
  INSERT INTO public.device_logs (user_id, log_date, direction, source, notes)
  VALUES
    (v_user_id, '2026-09-15 09:15:00+05:30', 'In', 'excel', 'App configured today — Out punch missing');

  -- ── Attendance Logs (daily summary) ────────────────────────
  -- ON CONFLICT DO UPDATE makes this idempotent (safe to re-run)

  -- 09-Sep: Present | 495 min net
  INSERT INTO public.attendance_logs
    (user_id, attendance_date, in_time, out_time, duration,
     status, status_code, p1_status, present, absent, weekly_off,
     is_on_leave, holiday, late_by, early_by, overtime, overtime_e,
     missed_out_punch, missed_in_punch, shift_id, source, remarks)
  VALUES
    (v_user_id, '2026-09-09', '2026-09-09 09:35:00+05:30', '2026-09-09 18:10:00+05:30', 495,
     'Present', 'P', 'P', 1.0, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 'excel', 'Excel Verified')
  ON CONFLICT (user_id, attendance_date) DO UPDATE SET
    in_time = EXCLUDED.in_time, out_time = EXCLUDED.out_time, duration = EXCLUDED.duration,
    status = EXCLUDED.status, status_code = EXCLUDED.status_code, present = EXCLUDED.present,
    source = EXCLUDED.source, remarks = EXCLUDED.remarks, updated_at = NOW();

  -- 10-Sep: Present | 580 min net
  INSERT INTO public.attendance_logs
    (user_id, attendance_date, in_time, out_time, duration,
     status, status_code, p1_status, present, absent, weekly_off,
     is_on_leave, holiday, late_by, early_by, overtime, overtime_e,
     missed_out_punch, missed_in_punch, shift_id, source, remarks)
  VALUES
    (v_user_id, '2026-09-10', '2026-09-10 09:05:00+05:30', '2026-09-10 19:00:00+05:30', 580,
     'Present', 'P', 'P', 1.0, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 'excel', 'Excel Verified')
  ON CONFLICT (user_id, attendance_date) DO UPDATE SET
    in_time = EXCLUDED.in_time, out_time = EXCLUDED.out_time, duration = EXCLUDED.duration,
    status = EXCLUDED.status, status_code = EXCLUDED.status_code, present = EXCLUDED.present,
    source = EXCLUDED.source, remarks = EXCLUDED.remarks, updated_at = NOW();

  -- 11-Sep: Present | 585 min net
  INSERT INTO public.attendance_logs
    (user_id, attendance_date, in_time, out_time, duration,
     status, status_code, p1_status, present, absent, weekly_off,
     is_on_leave, holiday, late_by, early_by, overtime, overtime_e,
     missed_out_punch, missed_in_punch, shift_id, source, remarks)
  VALUES
    (v_user_id, '2026-09-11', '2026-09-11 09:15:00+05:30', '2026-09-11 19:20:00+05:30', 585,
     'Present', 'P', 'P', 1.0, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 'excel', 'Excel Verified')
  ON CONFLICT (user_id, attendance_date) DO UPDATE SET
    in_time = EXCLUDED.in_time, out_time = EXCLUDED.out_time, duration = EXCLUDED.duration,
    status = EXCLUDED.status, status_code = EXCLUDED.status_code, present = EXCLUDED.present,
    source = EXCLUDED.source, remarks = EXCLUDED.remarks, updated_at = NOW();

  -- 12-Sep: Present | 580 min net
  INSERT INTO public.attendance_logs
    (user_id, attendance_date, in_time, out_time, duration,
     status, status_code, p1_status, present, absent, weekly_off,
     is_on_leave, holiday, late_by, early_by, overtime, overtime_e,
     missed_out_punch, missed_in_punch, shift_id, source, remarks)
  VALUES
    (v_user_id, '2026-09-12', '2026-09-12 09:25:00+05:30', '2026-09-12 19:35:00+05:30', 580,
     'Present', 'P', 'P', 1.0, 0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 'excel', 'Excel Verified')
  ON CONFLICT (user_id, attendance_date) DO UPDATE SET
    in_time = EXCLUDED.in_time, out_time = EXCLUDED.out_time, duration = EXCLUDED.duration,
    status = EXCLUDED.status, status_code = EXCLUDED.status_code, present = EXCLUDED.present,
    source = EXCLUDED.source, remarks = EXCLUDED.remarks, updated_at = NOW();

  -- 13-Sep: Sunday — Weekly Off
  INSERT INTO public.attendance_logs
    (user_id, attendance_date, in_time, out_time, duration,
     status, status_code, p1_status, present, absent, weekly_off,
     is_on_leave, holiday, late_by, early_by, overtime, overtime_e,
     missed_out_punch, missed_in_punch, shift_id, source, remarks)
  VALUES
    (v_user_id, '2026-09-13', NULL, NULL, 0,
     'WeekOff', 'WO', 'WO', 0.0, 0.0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 'excel', 'Excel Verified')
  ON CONFLICT (user_id, attendance_date) DO UPDATE SET
    status = EXCLUDED.status, status_code = EXCLUDED.status_code,
    weekly_off = EXCLUDED.weekly_off, source = EXCLUDED.source,
    remarks = EXCLUDED.remarks, updated_at = NOW();

  -- 14-Sep: Ganesh Chaturthi — Public Holiday
  INSERT INTO public.attendance_logs
    (user_id, attendance_date, in_time, out_time, duration,
     status, status_code, p1_status, present, absent, weekly_off,
     is_on_leave, holiday, late_by, early_by, overtime, overtime_e,
     missed_out_punch, missed_in_punch, shift_id, source, remarks)
  VALUES
    (v_user_id, '2026-09-14', NULL, NULL, 0,
     'Holiday', 'H', 'H', 0.0, 0.0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 'excel', 'Excel Verified - Ganesh Chaturthi')
  ON CONFLICT (user_id, attendance_date) DO UPDATE SET
    status = EXCLUDED.status, status_code = EXCLUDED.status_code,
    holiday = EXCLUDED.holiday, source = EXCLUDED.source,
    remarks = EXCLUDED.remarks, updated_at = NOW();

  -- 15-Sep: Present but MissedOutPunch (app configured today)
  INSERT INTO public.attendance_logs
    (user_id, attendance_date, in_time, out_time, duration,
     status, status_code, p1_status, present, absent, weekly_off,
     is_on_leave, holiday, late_by, early_by, overtime, overtime_e,
     missed_out_punch, missed_in_punch, shift_id, source, remarks)
  VALUES
    (v_user_id, '2026-09-15', '2026-09-15 09:15:00+05:30', NULL, 0,
     'Present', 'P', 'P', 1.0, 0.0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 'excel',
     'Excel Verified - App configured today, Out punch missing')
  ON CONFLICT (user_id, attendance_date) DO UPDATE SET
    in_time = EXCLUDED.in_time, status = EXCLUDED.status,
    missed_out_punch = EXCLUDED.missed_out_punch,
    source = EXCLUDED.source, remarks = EXCLUDED.remarks, updated_at = NOW();

  RAISE NOTICE 'Done: 7 attendance_logs + 17 device_logs inserted for %', v_user_id;
END;
$$;


-- ============================================================
-- VERIFY: Check inserted records
-- ============================================================
SELECT
  al.attendance_date,
  u.email,
  TO_CHAR(al.in_time  AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS in_ist,
  TO_CHAR(al.out_time AT TIME ZONE 'Asia/Kolkata', 'HH12:MI AM') AS out_ist,
  al.duration        AS "min",
  al.status_code,
  al.missed_out_punch,
  al.holiday,
  al.weekly_off,
  al.remarks
FROM public.attendance_logs al
JOIN public.users u ON u.id = al.user_id
WHERE u.email = 'noronhasanup@gmail.com'
  AND al.attendance_date BETWEEN '2026-09-09' AND '2026-09-15'
ORDER BY al.attendance_date;
