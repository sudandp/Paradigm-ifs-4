-- ============================================================
-- Attendance Rule Versioning & Month Locking Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- TABLE 1: attendance_rule_versions
-- Every time a rule changes, a new versioned row is inserted.
-- The calculation engine picks the version active on the target month.
CREATE TABLE IF NOT EXISTS attendance_rule_versions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type        TEXT        NOT NULL DEFAULT 'global',  -- 'global' | 'entity' | 'company' | 'location'
  scope_id          TEXT,                                   -- NULL for global rules
  settings          JSONB       NOT NULL,                   -- full attendance settings blob
  effective_from    DATE        NOT NULL,
  effective_till    DATE,                                   -- NULL = currently active
  created_by        TEXT,
  created_by_name   TEXT,
  change_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup: given a month, find the active version
CREATE INDEX IF NOT EXISTS idx_rule_versions_scope_date
  ON attendance_rule_versions (scope_type, scope_id, effective_from DESC);

-- Enable RLS
ALTER TABLE attendance_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage rule versions"
  ON attendance_rule_versions FOR ALL
  USING (true) WITH CHECK (true);

-- TABLE 2: attendance_month_snapshots
-- Stores frozen daily status data per employee per month once locked.
-- Locked months bypass live recalculation.
CREATE TABLE IF NOT EXISTS attendance_month_snapshots (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      TEXT        NOT NULL,
  year             INT         NOT NULL,
  month            INT         NOT NULL CHECK (month BETWEEN 1 AND 12),
  daily_data       JSONB       NOT NULL,  -- array of DailyData objects
  summary          JSONB       NOT NULL,  -- EmployeeMonthlyData totals (presentDays, absentDays, payableDays, etc.)
  rule_version_id  UUID        REFERENCES attendance_rule_versions(id) ON DELETE SET NULL,
  locked_by        TEXT        NOT NULL,
  locked_by_name   TEXT,
  locked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlock_reason    TEXT,
  unlocked_by      TEXT,
  unlocked_at      TIMESTAMPTZ,
  UNIQUE (employee_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_employee_month
  ON attendance_month_snapshots (employee_id, year, month);

CREATE INDEX IF NOT EXISTS idx_snapshots_year_month
  ON attendance_month_snapshots (year, month);

ALTER TABLE attendance_month_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage month snapshots"
  ON attendance_month_snapshots FOR ALL
  USING (true) WITH CHECK (true);

-- SEED: Insert current settings as the first rule version (retroactive baseline)
-- effective_from = 2024-01-01 so ALL historical months resolve to it as fallback
INSERT INTO attendance_rule_versions (scope_type, scope_id, settings, effective_from, change_reason, created_by_name)
SELECT
  'global',
  NULL,
  attendance_settings,
  '2024-01-01'::DATE,
  'Initial baseline — auto-seeded from current settings',
  'System Migration'
FROM settings
WHERE id = 'singleton'
  AND attendance_settings IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM attendance_rule_versions WHERE scope_type = 'global' AND scope_id IS NULL
  )
LIMIT 1;
