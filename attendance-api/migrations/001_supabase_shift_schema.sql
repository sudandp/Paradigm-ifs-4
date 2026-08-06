-- ============================================================================
--  SUPABASE MIGRATION — Shift State Machine Schema
--  DB     : Supabase (PostgreSQL)
--  Apply  : Open Supabase Dashboard → SQL Editor → Paste & Run
--  Safe   : All statements use IF NOT EXISTS / ON CONFLICT — fully idempotent.
-- ============================================================================

-- 1. TABLE: shift_master
CREATE TABLE IF NOT EXISTS public.shift_master (
  shift_code        TEXT         NOT NULL PRIMARY KEY,
  shift_name        TEXT         NOT NULL,
  start_mins        SMALLINT     NOT NULL,
  end_mins          SMALLINT     NOT NULL,
  crosses_midnight  BOOLEAN      NOT NULL DEFAULT false,
  grace_minutes     SMALLINT     NOT NULL DEFAULT 60,
  max_duration_hrs  NUMERIC(4,1) NOT NULL,
  role_category     TEXT         NOT NULL,
  is_active         BOOLEAN      NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Seed default shifts
INSERT INTO public.shift_master
  (shift_code, shift_name, start_mins, end_mins, crosses_midnight, grace_minutes, max_duration_hrs, role_category)
VALUES
  ('A',         'A Shift',        420,  840,  false, 60,  8.0,  'Staff'),
  ('B',         'B Shift',        840,  1260, false, 60,  8.0,  'Staff'),
  ('C',         'C Shift',       1260,  420,  true,  60, 11.0,  'Staff'),
  ('SEC_DAY',   'Security Day',   480,  1200, false, 60, 13.0,  'Security'),
  ('SEC_NIGHT', 'Security Night', 1200, 480,  true,  60, 13.0,  'Security'),
  ('GEN',       'General Shift',  540,  1080, false, 60, 10.0,  'Admin')
ON CONFLICT (shift_code) DO UPDATE SET
  shift_name       = EXCLUDED.shift_name,
  start_mins       = EXCLUDED.start_mins,
  end_mins         = EXCLUDED.end_mins,
  crosses_midnight = EXCLUDED.crosses_midnight,
  grace_minutes    = EXCLUDED.grace_minutes,
  max_duration_hrs = EXCLUDED.max_duration_hrs,
  role_category    = EXCLUDED.role_category,
  updated_at       = now();

ALTER TABLE public.shift_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shift_master read by authenticated" ON public.shift_master;
CREATE POLICY "shift_master read by authenticated" ON public.shift_master FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "shift_master write by service" ON public.shift_master;
CREATE POLICY "shift_master write by service" ON public.shift_master FOR ALL TO service_role USING (true);
GRANT SELECT ON public.shift_master TO authenticated;
GRANT ALL    ON public.shift_master TO service_role;

-- 2. TABLE: role_sequence_rules
CREATE TABLE IF NOT EXISTS public.role_sequence_rules (
  id               BIGSERIAL    PRIMARY KEY,
  role_category    TEXT         NOT NULL,
  from_shift_code  TEXT         NOT NULL REFERENCES public.shift_master(shift_code),
  to_shift_code    TEXT         NOT NULL REFERENCES public.shift_master(shift_code),
  max_segments     SMALLINT     NOT NULL,
  hard_ceiling_hrs NUMERIC(4,1) NOT NULL,
  is_active        BOOLEAN      NOT NULL DEFAULT true,
  CONSTRAINT uq_role_transition UNIQUE (role_category, from_shift_code, to_shift_code)
);

INSERT INTO public.role_sequence_rules
  (role_category, from_shift_code, to_shift_code, max_segments, hard_ceiling_hrs)
VALUES
  ('Staff',    'A',         'B',          6, 48.0),
  ('Staff',    'B',         'C',          6, 48.0),
  ('Staff',    'C',         'A',          6, 48.0),
  ('Security', 'SEC_DAY',   'SEC_NIGHT',  4, 48.0),
  ('Security', 'SEC_NIGHT', 'SEC_DAY',    4, 48.0),
  ('Admin',    'GEN',       'GEN',        1, 10.0)
ON CONFLICT (role_category, from_shift_code, to_shift_code) DO NOTHING;

ALTER TABLE public.role_sequence_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rsr read by authenticated" ON public.role_sequence_rules;
CREATE POLICY "rsr read by authenticated" ON public.role_sequence_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rsr write by service" ON public.role_sequence_rules;
CREATE POLICY "rsr write by service" ON public.role_sequence_rules FOR ALL TO service_role USING (true);
GRANT SELECT ON public.role_sequence_rules TO authenticated;
GRANT ALL    ON public.role_sequence_rules TO service_role;

-- 3. TABLE: employee_roster
CREATE TABLE IF NOT EXISTS public.employee_roster (
  id             BIGSERIAL    PRIMARY KEY,
  employee_code  TEXT         NOT NULL,
  roster_date    DATE         NOT NULL,
  shift_code     TEXT         NOT NULL REFERENCES public.shift_master(shift_code),
  is_off_day     BOOLEAN      NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_roster_emp_date UNIQUE (employee_code, roster_date)
);

CREATE INDEX IF NOT EXISTS ix_employee_roster_code_date ON public.employee_roster (employee_code, roster_date);
ALTER TABLE public.employee_roster ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roster read by authenticated" ON public.employee_roster;
CREATE POLICY "roster read by authenticated" ON public.employee_roster FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "roster write by service" ON public.employee_roster;
CREATE POLICY "roster write by service" ON public.employee_roster FOR ALL TO service_role USING (true);
GRANT SELECT ON public.employee_roster TO authenticated;
GRANT ALL    ON public.employee_roster TO service_role;

-- 4. TABLE: duty_instance
CREATE TABLE IF NOT EXISTS public.duty_instance (
  id                 BIGSERIAL    PRIMARY KEY,
  employee_code      TEXT         NOT NULL,
  roster_date        DATE         NOT NULL,
  started_at         TIMESTAMPTZ  NOT NULL,
  ended_at           TIMESTAMPTZ  NULL,
  status             TEXT         NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','COMPLETED','EXCEPTION')),
  duty_type          TEXT         NOT NULL DEFAULT 'NORMAL' CHECK (duty_type IN ('NORMAL','EXTENDED_COVERAGE')),
  total_duration_hrs NUMERIC(5,2) NULL,
  segment_count      SMALLINT     NOT NULL DEFAULT 0,
  declaration_logged BOOLEAN      NOT NULL DEFAULT false,
  declared_by        TEXT         NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_duty_instance_emp_status ON public.duty_instance (employee_code, status, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_duty_instance_emp_date ON public.duty_instance (employee_code, roster_date);
ALTER TABLE public.duty_instance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "duty_instance read by authenticated" ON public.duty_instance;
CREATE POLICY "duty_instance read by authenticated" ON public.duty_instance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "duty_instance write by service" ON public.duty_instance;
CREATE POLICY "duty_instance write by service" ON public.duty_instance FOR ALL TO service_role USING (true);
GRANT SELECT ON public.duty_instance TO authenticated;
GRANT ALL    ON public.duty_instance TO service_role;

-- 5. TABLE: duty_segment
CREATE TABLE IF NOT EXISTS public.duty_segment (
  id             BIGSERIAL    PRIMARY KEY,
  duty_id        BIGINT       NOT NULL REFERENCES public.duty_instance(id),
  shift_code     TEXT         NOT NULL REFERENCES public.shift_master(shift_code),
  sequence_no    SMALLINT     NOT NULL,
  segment_start  TIMESTAMPTZ  NOT NULL,
  segment_end    TIMESTAMPTZ  NULL,
  duration_hrs   NUMERIC(5,2) NULL,
  ot_hrs         NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_duty_segment_seq UNIQUE (duty_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS ix_duty_segment_duty_id ON public.duty_segment (duty_id);
ALTER TABLE public.duty_segment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "duty_segment read by authenticated" ON public.duty_segment;
CREATE POLICY "duty_segment read by authenticated" ON public.duty_segment FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "duty_segment write by service" ON public.duty_segment;
CREATE POLICY "duty_segment write by service" ON public.duty_segment FOR ALL TO service_role USING (true);
GRANT SELECT ON public.duty_segment TO authenticated;
GRANT ALL    ON public.duty_segment TO service_role;

-- 6. TABLE: exception_queue
CREATE TABLE IF NOT EXISTS public.exception_queue (
  id               BIGSERIAL    PRIMARY KEY,
  employee_code    TEXT         NOT NULL,
  roster_date      DATE         NOT NULL,
  exception_type   TEXT         NOT NULL CHECK (exception_type IN ('MISSING_IN','MISSING_OUT','CROSS_DAY_MISMATCH','DURATION_EXCEEDED','POSSIBLE_EXTENDED_COVERAGE','INVALID_SEQUENCE','ORPHAN_PUNCH_LOCKED')),
  raw_punches      JSONB        NULL,
  duty_instance_id BIGINT       NULL REFERENCES public.duty_instance(id),
  status           TEXT         NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  approved_by      TEXT         NULL,
  approved_at      TIMESTAMPTZ  NULL,
  approved_shift   TEXT         NULL REFERENCES public.shift_master(shift_code),
  approved_duration NUMERIC(5,2) NULL,
  remarks          TEXT         NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_exception_queue_emp_date ON public.exception_queue (employee_code, roster_date);
CREATE INDEX IF NOT EXISTS ix_exception_queue_status ON public.exception_queue (status, created_at DESC);
ALTER TABLE public.exception_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exception_queue read by admin" ON public.exception_queue;
CREATE POLICY "exception_queue read by admin" ON public.exception_queue FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "exception_queue write by service" ON public.exception_queue;
CREATE POLICY "exception_queue write by service" ON public.exception_queue FOR ALL TO service_role USING (true);
GRANT SELECT ON public.exception_queue TO authenticated;
GRANT ALL    ON public.exception_queue TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

SELECT 'Supabase Shift Schema applied successfully' AS result;
