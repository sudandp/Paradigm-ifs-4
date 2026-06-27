-- =============================================================================
-- Migration: 20260627_001_attendance_rule_engine_schema.sql
-- Module:    1 — Configurable Field Staff Attendance Rule Engine (Schema Only)
-- Strategy:  Purely additive — no existing tables/columns dropped or renamed.
--            All new columns use DEFAULT so existing rows are backfilled silently.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART A: Extend attendance_settings_scopes scope_type
-- The existing CHECK only allows 'location' | 'company' | 'entity'.
-- We need to support 'region', 'branch', 'shift', 'employee' for hierarchy.
-- We REPLACE the constraint (ALTER + ADD) — safe, no data is changed.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Drop old constraint if it exists by name
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attendance_settings_scopes'
      AND constraint_name = 'attendance_settings_scopes_scope_type_check'
  ) THEN
    ALTER TABLE public.attendance_settings_scopes
      DROP CONSTRAINT attendance_settings_scopes_scope_type_check;
  END IF;
END $$;

ALTER TABLE public.attendance_settings_scopes
  ADD CONSTRAINT attendance_settings_scopes_scope_type_check
  CHECK (scope_type IN (
    'global',    -- company-wide default (mirrors settings singleton)
    'location',  -- physical office/branch location
    'company',   -- client company / society
    'entity',    -- site / entity
    'region',    -- NEW: geographic region grouping
    'branch',    -- NEW: branch within a region
    'shift',     -- NEW: shift-specific overrides
    'employee'   -- NEW: individual employee override (highest priority)
  ));

-- ---------------------------------------------------------------------------
-- PART B: Extend attendance_rule_versions scope_type (same reasoning)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attendance_rule_versions'
      AND constraint_name = 'attendance_rule_versions_scope_type_check'
  ) THEN
    ALTER TABLE public.attendance_rule_versions
      DROP CONSTRAINT attendance_rule_versions_scope_type_check;
  END IF;
END $$;

-- The column has a DEFAULT of 'global' — no CHECK was originally defined;
-- we add one now for data integrity.
ALTER TABLE public.attendance_rule_versions
  ADD CONSTRAINT attendance_rule_versions_scope_type_check
  CHECK (scope_type IN (
    'global', 'location', 'company', 'entity', 'region', 'branch', 'shift', 'employee'
  ));

-- ---------------------------------------------------------------------------
-- PART C: New table — rule_inheritance_cache
-- Stores the RESOLVED effective rules per user so the app doesn't need to
-- walk the entire hierarchy on every request.
-- TTL: cache is invalidated whenever any ancestor scope changes (via trigger).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rule_inheritance_cache (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  resolved_settings JSONB       NOT NULL,  -- merged StaffAttendanceRules
  resolved_scope    TEXT        NOT NULL,  -- which scope "won" (e.g. 'entity:abc123')
  inheritance_path  TEXT[]      NOT NULL DEFAULT '{}', -- ordered list of scopes consulted
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_rule_cache_user_id
  ON public.rule_inheritance_cache (user_id);

CREATE INDEX IF NOT EXISTS idx_rule_cache_expires
  ON public.rule_inheritance_cache (expires_at);

ALTER TABLE public.rule_inheritance_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rule cache"
  ON public.rule_inheritance_cache FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage rule cache"
  ON public.rule_inheritance_cache FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role_id IN ('admin', 'super_admin', 'hr', 'hr_ops', 'management')
    )
  )
  WITH CHECK (true);

-- Function to invalidate cache for all users affected by a scope change
CREATE OR REPLACE FUNCTION public.invalidate_rule_cache_for_scope(
  p_scope_type TEXT,
  p_scope_id   TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete all cached entries whose inheritance_path includes this scope
  DELETE FROM public.rule_inheritance_cache
  WHERE p_scope_type || ':' || p_scope_id = ANY(inheritance_path)
     OR (p_scope_type = 'global');  -- global change invalidates everything

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- PART D: Extend users table with rule engine metadata
-- All columns have DEFAULT → no existing row is broken.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS vehicle_type          TEXT    DEFAULT 'two_wheeler'
    CHECK (vehicle_type IN ('two_wheeler', 'four_wheeler_petrol', 'four_wheeler_diesel', 'public_transport', 'company_vehicle', 'none')),
  ADD COLUMN IF NOT EXISTS home_latitude         NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS home_longitude        NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS weekly_off_pattern    TEXT    DEFAULT 'fixed'
    CHECK (weekly_off_pattern IN ('fixed', 'rotational', 'alternate_saturday', '2nd_4th_saturday')),
  ADD COLUMN IF NOT EXISTS rule_scope_overrides  JSONB   DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS effective_rules_at    TIMESTAMPTZ; -- timestamp when cache was last built

COMMENT ON COLUMN public.users.vehicle_type IS
  'Vehicle type used by field staff for travel reimbursement. Drives fuel rate lookup.';
COMMENT ON COLUMN public.users.home_latitude IS
  'Home geolocation for travel distance calculation (home→site→home route).';
COMMENT ON COLUMN public.users.weekly_off_pattern IS
  'Rotational weekly off schedule type. ''fixed'' uses weeklyOffDays[]. Others use pattern logic.';
COMMENT ON COLUMN public.users.rule_scope_overrides IS
  'Per-user rule overrides that take highest priority in the inheritance chain.';

-- ---------------------------------------------------------------------------
-- PART E: Extend site_staff_config with billing/payroll engine fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.site_staff_config
  ADD COLUMN IF NOT EXISTS vehicle_type          TEXT    DEFAULT 'two_wheeler'
    CHECK (vehicle_type IN ('two_wheeler', 'four_wheeler_petrol', 'four_wheeler_diesel', 'public_transport', 'company_vehicle', 'none')),
  ADD COLUMN IF NOT EXISTS per_day_rate_type     TEXT    DEFAULT 'CTC/26'
    CHECK (per_day_rate_type IN ('CTC/26', 'CTC/30', 'CTC/25', 'custom', 'fixed_daily')),
  ADD COLUMN IF NOT EXISTS custom_divisor        NUMERIC,
  ADD COLUMN IF NOT EXISTS home_to_site_km       NUMERIC(8, 2),   -- one-way distance
  ADD COLUMN IF NOT EXISTS deduction_km          NUMERIC(8, 2) DEFAULT 0,  -- km not reimbursed (e.g., 24km rule)
  ADD COLUMN IF NOT EXISTS wo_billing_config     TEXT    DEFAULT 'NA'
    CHECK (wo_billing_config IN ('NA', 'Actuals', 'Double')),
  ADD COLUMN IF NOT EXISTS ot_billing_config     TEXT    DEFAULT 'NA'
    CHECK (ot_billing_config IN ('NA', 'Actuals', 'Double')),
  ADD COLUMN IF NOT EXISTS weekly_off_pattern    TEXT    DEFAULT 'fixed'
    CHECK (weekly_off_pattern IN ('fixed', 'rotational', 'alternate_saturday', '2nd_4th_saturday'));

COMMENT ON COLUMN public.site_staff_config.home_to_site_km IS
  'One-way distance from employee home to primary site. Used for 24km deduction logic.';
COMMENT ON COLUMN public.site_staff_config.deduction_km IS
  'Km deducted per trip before reimbursement (e.g., 24km rule = 24).';

-- ---------------------------------------------------------------------------
-- PART F: New table — travel_rules_config
-- Stores configurable rules for travel distance and reimbursement.
-- Scoped per entity/company/global, supports city-wise fuel rates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.travel_rules_config (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type            TEXT        NOT NULL DEFAULT 'global'
    CHECK (scope_type IN ('global', 'company', 'entity', 'region')),
  scope_id              TEXT,       -- NULL for global rules
  city                  TEXT,       -- NULL = default for all cities; e.g. 'Bangalore', 'Mumbai'

  -- Vehicle fuel rates (₹ per km)
  two_wheeler_rate       NUMERIC(8, 2) NOT NULL DEFAULT 6.00,
  four_wheeler_petrol_rate NUMERIC(8, 2) NOT NULL DEFAULT 16.00,
  four_wheeler_diesel_rate NUMERIC(8, 2) NOT NULL DEFAULT 14.00,
  public_transport_rate  NUMERIC(8, 2) NOT NULL DEFAULT 0.00,  -- actual receipts
  company_vehicle_rate   NUMERIC(8, 2) NOT NULL DEFAULT 0.00,  -- borne by company

  -- Deduction rules
  daily_deduction_km     NUMERIC(8, 2) NOT NULL DEFAULT 0.00,  -- km subtracted before calc (e.g. 24)
  apply_deduction_per    TEXT        NOT NULL DEFAULT 'day'
    CHECK (apply_deduction_per IN ('day', 'trip', 'month')),
  distance_buffer_pct    NUMERIC(5, 2) NOT NULL DEFAULT 5.00,  -- % buffer on Google Maps distance

  -- Validation toggles
  enable_google_maps_validation BOOLEAN NOT NULL DEFAULT FALSE,
  enable_travel_reimbursement   BOOLEAN NOT NULL DEFAULT FALSE,
  enable_idle_time_tracking     BOOLEAN NOT NULL DEFAULT FALSE,
  max_idle_minutes_per_day      INTEGER NOT NULL DEFAULT 60,

  -- Site time thresholds (override StaffAttendanceRules if set)
  minimum_site_pct      NUMERIC(5, 2),   -- e.g. 75.0 — NULL = use global rules
  minimum_site_hours    NUMERIC(5, 2),   -- e.g. 4.0

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID        REFERENCES public.users(id) ON DELETE SET NULL,

  UNIQUE (scope_type, scope_id, city)
);

CREATE INDEX IF NOT EXISTS idx_travel_rules_scope
  ON public.travel_rules_config (scope_type, scope_id);

ALTER TABLE public.travel_rules_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage travel rules"
  ON public.travel_rules_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role_id IN ('admin', 'super_admin', 'hr', 'hr_ops', 'management', 'finance_manager')
    )
  )
  WITH CHECK (true);

CREATE POLICY "All authenticated can read travel rules"
  ON public.travel_rules_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed global default travel rules (no existing data conflict)
INSERT INTO public.travel_rules_config (
  scope_type, scope_id, city,
  two_wheeler_rate, four_wheeler_petrol_rate, four_wheeler_diesel_rate,
  daily_deduction_km, distance_buffer_pct,
  enable_google_maps_validation, enable_travel_reimbursement
)
VALUES (
  'global', NULL, NULL,
  6.00, 16.00, 14.00,
  0.00, 5.00,
  FALSE, FALSE
)
ON CONFLICT (scope_type, scope_id, city) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART G: New table — travel_logs
-- One row per employee per trip segment (site-in → site-out).
-- Populated by the travel engine service, not by direct user input.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.travel_logs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date            DATE        NOT NULL,
  entity_id           TEXT,       -- site/entity visited
  entity_name         TEXT,

  -- Segment metadata
  segment_type        TEXT        NOT NULL DEFAULT 'site_visit'
    CHECK (segment_type IN ('home_to_site', 'site_to_site', 'site_to_home', 'idle', 'site_visit')),

  -- GPS data
  origin_lat          NUMERIC(10, 7),
  origin_lng          NUMERIC(10, 7),
  dest_lat            NUMERIC(10, 7),
  dest_lng            NUMERIC(10, 7),
  origin_name         TEXT,
  dest_name           TEXT,

  -- Distance and time
  distance_km         NUMERIC(10, 3),  -- raw GPS/Maps distance
  buffered_km         NUMERIC(10, 3),  -- after applying buffer_pct
  deducted_km         NUMERIC(10, 3),  -- after applying daily deduction rule
  reimbursable_km     NUMERIC(10, 3),  -- final km for payment
  duration_minutes    INTEGER,
  idle_minutes        INTEGER DEFAULT 0,

  -- Attendance event linkage
  site_in_event_id    UUID        REFERENCES public.attendance_events(id) ON DELETE SET NULL,
  site_out_event_id   UUID        REFERENCES public.attendance_events(id) ON DELETE SET NULL,

  -- Reimbursement
  vehicle_type        TEXT,
  rate_per_km         NUMERIC(8, 2),
  reimbursement_amount NUMERIC(10, 2),
  currency            TEXT        DEFAULT 'INR',

  -- Status
  status              TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'computed', 'approved', 'paid', 'disputed')),
  computed_at         TIMESTAMPTZ,
  approved_by         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,

  -- Meta
  source              TEXT        NOT NULL DEFAULT 'auto'
    CHECK (source IN ('auto', 'manual', 'biometric', 'offline_sync')),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_logs_user_date
  ON public.travel_logs (user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_travel_logs_entity
  ON public.travel_logs (entity_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_travel_logs_status
  ON public.travel_logs (status) WHERE status IN ('draft', 'computed');

ALTER TABLE public.travel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own travel logs"
  ON public.travel_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view team travel logs"
  ON public.travel_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = public.travel_logs.user_id
      AND users.reporting_manager_id = auth.uid()
    )
  );

CREATE POLICY "Finance and Admins can view all travel logs"
  ON public.travel_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role_id IN ('admin', 'super_admin', 'hr', 'hr_ops', 'management', 'finance_manager', 'finance', 'finance_ops')
    )
  );

CREATE POLICY "System can insert travel logs"
  ON public.travel_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Finance and Admins can update travel logs"
  ON public.travel_logs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role_id IN ('admin', 'super_admin', 'finance_manager', 'finance', 'hr')
    )
  );

-- ---------------------------------------------------------------------------
-- PART H: New table — reimbursement_claims
-- Monthly rollup of all travel_logs → one claim per employee per month.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reimbursement_claims (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year                INTEGER     NOT NULL,
  month               INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- Totals computed from travel_logs
  total_trips         INTEGER     NOT NULL DEFAULT 0,
  total_distance_km   NUMERIC(10, 3) NOT NULL DEFAULT 0,
  total_deducted_km   NUMERIC(10, 3) NOT NULL DEFAULT 0,
  total_reimbursable_km NUMERIC(10, 3) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency            TEXT        NOT NULL DEFAULT 'INR',

  -- Status
  status              TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'paid', 'rejected')),

  -- Audit
  submitted_at        TIMESTAMPTZ,
  approved_by         UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  rejection_reason    TEXT,
  notes               TEXT,

  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_reimbursement_user_month
  ON public.reimbursement_claims (user_id, year DESC, month DESC);

CREATE INDEX IF NOT EXISTS idx_reimbursement_status
  ON public.reimbursement_claims (status) WHERE status IN ('draft', 'submitted');

ALTER TABLE public.reimbursement_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reimbursement claims"
  ON public.reimbursement_claims FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view team reimbursements"
  ON public.reimbursement_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = public.reimbursement_claims.user_id
      AND users.reporting_manager_id = auth.uid()
    )
  );

CREATE POLICY "Finance and Admins can manage all reimbursements"
  ON public.reimbursement_claims FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role_id IN ('admin', 'super_admin', 'hr', 'finance_manager', 'finance', 'management')
    )
  )
  WITH CHECK (true);

CREATE POLICY "System can insert reimbursement claims"
  ON public.reimbursement_claims FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- PART I: New table — payroll_snapshots
-- Monthly payroll computation result per employee.
-- Input: attendance_month_snapshots + travel_logs + leave_requests.
-- Output: final payable amounts (NOT billing — billing is separate).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_snapshots (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  year                      INTEGER     NOT NULL,
  month                     INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),

  -- Source linkage
  attendance_snapshot_id    UUID        REFERENCES public.attendance_month_snapshots(id) ON DELETE SET NULL,
  rule_version_id           UUID        REFERENCES public.attendance_rule_versions(id) ON DELETE SET NULL,

  -- Attendance counts (from snapshot)
  present_days              NUMERIC(5, 2) NOT NULL DEFAULT 0,
  half_days                 NUMERIC(5, 2) NOT NULL DEFAULT 0,
  absent_days               INTEGER     NOT NULL DEFAULT 0,
  week_off_days             INTEGER     NOT NULL DEFAULT 0,
  holiday_days              INTEGER     NOT NULL DEFAULT 0,
  leave_days                NUMERIC(5, 2) NOT NULL DEFAULT 0,
  loss_of_pay_days          NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ot_hours                  NUMERIC(7, 2) NOT NULL DEFAULT 0,

  -- Salary computation
  ctc_per_month             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  working_days_in_month     INTEGER     NOT NULL DEFAULT 26,  -- divisor used
  per_day_salary            NUMERIC(10, 4),  -- ctc / divisor
  payable_days              NUMERIC(5, 2) NOT NULL DEFAULT 0,
  base_payable_amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,

  -- Adjustments
  travel_reimbursement      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ot_amount                 NUMERIC(12, 2) NOT NULL DEFAULT 0,
  holiday_bonus             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  manual_deduction          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  manual_bonus              NUMERIC(12, 2) NOT NULL DEFAULT 0,
  adjustments_notes         TEXT,

  -- Final
  gross_payable             NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- base + travel + OT + bonus - deductions
  currency                  TEXT        NOT NULL DEFAULT 'INR',

  -- Status
  status                    TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'computed', 'approved', 'disbursed', 'locked')),
  is_locked                 BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Audit
  computed_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by               UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at               TIMESTAMPTZ,
  locked_by                 UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  locked_at                 TIMESTAMPTZ,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_user_month
  ON public.payroll_snapshots (user_id, year DESC, month DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_status
  ON public.payroll_snapshots (status) WHERE status NOT IN ('disbursed', 'locked');

ALTER TABLE public.payroll_snapshots ENABLE ROW LEVEL SECURITY;

-- Employees can view their own payroll (amounts visible after approval)
CREATE POLICY "Employees can view own approved payroll"
  ON public.payroll_snapshots FOR SELECT
  USING (auth.uid() = user_id AND status IN ('approved', 'disbursed', 'locked'));

CREATE POLICY "Finance and Admins can manage all payroll"
  ON public.payroll_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role_id IN ('admin', 'super_admin', 'finance_manager', 'finance', 'hr', 'management')
    )
  )
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- PART J: New table — attendance_daily_status_log
-- Stores per-day attendance status (resolved) for EACH employee per day.
-- Unlike snapshots (monthly), this is live and updated on each sync.
-- Enables the rule engine to detect Late, EarlyExit, MissedPunch in real-time.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_daily_status_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date        DATE        NOT NULL,

  -- Resolved status (config-driven, not hardcoded)
  status_code     TEXT        NOT NULL DEFAULT 'A',
  -- Valid codes: P, 1/2P, 3/4P, 1/4P, A, L, HL, H, WO, BL, OT, LOP,
  --              LATE, EARLY_EXIT, MISSED_PUNCH, TRAVEL, SITE_DUTY, SH
  status_label    TEXT,       -- Human-readable: 'Present', 'Half Day', etc.

  -- Time data
  first_check_in  TIMESTAMPTZ,
  last_check_out  TIMESTAMPTZ,
  work_hours      NUMERIC(6, 2),
  site_hours      NUMERIC(6, 2),
  travel_hours    NUMERIC(6, 2),
  idle_hours      NUMERIC(6, 2),

  -- Flags
  is_late         BOOLEAN     NOT NULL DEFAULT FALSE,
  is_early_exit   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_missed_punch BOOLEAN     NOT NULL DEFAULT FALSE,
  is_manual       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_override     BOOLEAN     NOT NULL DEFAULT FALSE,  -- admin override applied

  -- Rule linkage
  rule_version_id UUID        REFERENCES public.attendance_rule_versions(id) ON DELETE SET NULL,
  override_by     UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  override_reason TEXT,

  -- Meta
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_status_user_date
  ON public.attendance_daily_status_log (user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_status_date
  ON public.attendance_daily_status_log (log_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_status_late
  ON public.attendance_daily_status_log (log_date, is_late) WHERE is_late = TRUE;

ALTER TABLE public.attendance_daily_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily status"
  ON public.attendance_daily_status_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view team daily status"
  ON public.attendance_daily_status_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = public.attendance_daily_status_log.user_id
      AND users.reporting_manager_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all daily status"
  ON public.attendance_daily_status_log FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role_id IN ('admin', 'super_admin', 'hr', 'hr_ops', 'management')
    )
  )
  WITH CHECK (true);

CREATE POLICY "System can insert and update daily status"
  ON public.attendance_daily_status_log FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- PART K: Config-driven SQL function — resolve_user_staff_category
-- Replaces the hardcoded role_id IN ('admin','hr',...) logic in the existing
-- dashboard functions. Reads from settings.attendance_settings.missedCheckoutConfig.roleMapping
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_user_staff_category(p_role_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_mapping JSONB;
  category     TEXT := 'field'; -- safe default
BEGIN
  -- Try to read roleMapping from settings
  SELECT attendance_settings->'missedCheckoutConfig'->'roleMapping'
  INTO role_mapping
  FROM public.settings
  WHERE id = 'singleton';

  -- If no mapping configured, use legacy hardcoded fallback
  IF role_mapping IS NULL THEN
    IF p_role_id IN (
      'admin', 'hr', 'finance', 'developer', 'management', 'office_staff',
      'back_office_staff', 'bd', 'operation_manager', 'field_staff',
      'finance_manager', 'hr_ops', 'business developer', 'unverified',
      'operation manager', 'field staff', 'finance manager', 'hr ops',
      'super_admin', 'director'
    ) THEN
      RETURN 'office';
    ELSIF p_role_id IN ('site_manager', 'site_supervisor', 'site manager', 'site supervisor') THEN
      RETURN 'site';
    ELSE
      RETURN 'field';
    END IF;
  END IF;

  -- Walk the mapping to find the category for this role
  -- roleMapping has shape: { office: ['admin',...], field: [...], site: [...] }
  IF role_mapping->'office' IS NOT NULL AND
     EXISTS (SELECT 1 FROM jsonb_array_elements_text(role_mapping->'office') r WHERE r = p_role_id) THEN
    RETURN 'office';
  END IF;

  IF role_mapping->'site' IS NOT NULL AND
     EXISTS (SELECT 1 FROM jsonb_array_elements_text(role_mapping->'site') r WHERE r = p_role_id) THEN
    RETURN 'site';
  END IF;

  IF role_mapping->'admin' IS NOT NULL AND
     EXISTS (SELECT 1 FROM jsonb_array_elements_text(role_mapping->'admin') r WHERE r = p_role_id) THEN
    RETURN 'admin';
  END IF;

  IF role_mapping->'management' IS NOT NULL AND
     EXISTS (SELECT 1 FROM jsonb_array_elements_text(role_mapping->'management') r WHERE r = p_role_id) THEN
    RETURN 'management';
  END IF;

  IF role_mapping->'field' IS NOT NULL AND
     EXISTS (SELECT 1 FROM jsonb_array_elements_text(role_mapping->'field') r WHERE r = p_role_id) THEN
    RETURN 'field';
  END IF;

  RETURN 'field'; -- ultimate safe fallback
END;
$$;

COMMENT ON FUNCTION public.resolve_user_staff_category IS
  'Config-driven replacement for hardcoded role→category mapping. Reads roleMapping from settings.attendance_settings. Falls back to legacy hardcoded list if not configured. Use this instead of inline CASE WHEN role_id IN (...).';

-- ---------------------------------------------------------------------------
-- PART L: Rewrite get_attendance_dashboard_data to use config-driven function
-- This replaces the hardcoded CASE WHEN role_id IN ('admin','hr',...) block.
-- Behavior is IDENTICAL for existing roles — config adds new flexibility.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_attendance_dashboard_data(
  start_date_iso  TEXT,
  end_date_iso    TEXT,
  current_date_iso TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result   JSONB;
  start_dt DATE := start_date_iso::DATE;
  end_dt   DATE := end_date_iso::DATE;
  current_dt DATE := current_date_iso::DATE;
BEGIN
  WITH user_date_matrix AS (
    SELECT u.id AS user_id, u.role_id,
           public.resolve_user_staff_category(u.role_id) AS staff_cat,
           d.day::DATE
    FROM public.users u
    CROSS JOIN generate_series(start_dt, end_dt, '1 day'::INTERVAL) AS d(day)
  ),
  daily_events AS (
    SELECT user_id,
           "timestamp"::DATE AS event_date,
           MIN(CASE WHEN type IN ('check-in', 'punch-in', 'Site In') THEN "timestamp" END) AS first_check_in,
           MAX(CASE WHEN type IN ('check-out', 'punch-out', 'Site Out') THEN "timestamp" END) AS last_check_out
    FROM public.attendance_events
    WHERE "timestamp"::DATE BETWEEN start_dt AND end_dt
    GROUP BY user_id, event_date
  ),
  daily_status AS (
    SELECT
      udm.user_id,
      udm.day,
      (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0) AS work_hours,
      CASE
        WHEN lr.id IS NOT NULL THEN
          CASE
            WHEN lr.leave_type = 'WFH'         THEN 'Present'
            WHEN lr.day_option = 'half'          THEN 'On Leave (Half)'
            ELSE                                      'On Leave (Full)'
          END
        WHEN de.first_check_in IS NOT NULL THEN
          CASE
            WHEN de.last_check_out IS NULL THEN
              CASE WHEN udm.day < current_dt THEN 'Absent' ELSE 'Incomplete' END
            WHEN (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0)
                 >= (s.attendance_settings->udm.staff_cat->>'minimumHoursFullDay')::NUMERIC THEN 'Present'
            WHEN (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0)
                 >= (s.attendance_settings->udm.staff_cat->>'minimumHoursHalfDay')::NUMERIC THEN 'Half Day'
            ELSE 'Absent'
          END
        WHEN h.id IS NOT NULL THEN 'Holiday'
        WHEN EXTRACT(DOW FROM udm.day) = ANY(
          ARRAY(
            SELECT value::INT
            FROM jsonb_array_elements_text(
              COALESCE(s.attendance_settings->udm.staff_cat->'weeklyOffDays', '[0]'::jsonb)
            )
          )
        ) THEN 'Weekend'
        ELSE 'Absent'
      END AS status
    FROM user_date_matrix udm
    LEFT JOIN daily_events de ON udm.user_id = de.user_id AND udm.day = de.event_date
    LEFT JOIN public.leave_requests lr
      ON udm.user_id = lr.user_id
      AND lr.status = 'approved'
      AND udm.day BETWEEN lr.start_date AND lr.end_date
    LEFT JOIN public.holidays h
      ON udm.day = h.date
      AND h.type = udm.staff_cat
    CROSS JOIN public.settings s
    WHERE s.id = 'singleton'
  ),
  aggregated_trends AS (
    SELECT
      day,
      COUNT(*) FILTER (WHERE status IN ('Present', 'Half Day', 'Incomplete')) AS present_count,
      COUNT(*) FILTER (WHERE status = 'Absent')                               AS absent_count,
      AVG(work_hours) FILTER (WHERE work_hours IS NOT NULL
                                AND status IN ('Present', 'Half Day'))        AS avg_hours
    FROM daily_status
    GROUP BY day
    ORDER BY day
  )
  SELECT jsonb_build_object(
    'totalEmployees',  (SELECT COUNT(*) FROM public.users),
    'presentToday',    (SELECT COUNT(*) FROM daily_status WHERE day = current_dt AND status IN ('Present', 'Half Day', 'Incomplete')),
    'absentToday',     (SELECT COUNT(*) FROM daily_status WHERE day = current_dt AND status = 'Absent'),
    'onLeaveToday',    (SELECT COUNT(*) FROM daily_status WHERE day = current_dt AND status LIKE 'On Leave%'),
    'attendanceTrend', (
      SELECT jsonb_build_object(
        'labels',  jsonb_agg(TO_CHAR(day, 'Dy dd')),
        'present', jsonb_agg(present_count),
        'absent',  jsonb_agg(absent_count)
      )
      FROM aggregated_trends
    ),
    'productivityTrend', (
      SELECT jsonb_build_object(
        'labels', jsonb_agg(TO_CHAR(day, 'Dy dd')),
        'hours',  jsonb_agg(COALESCE(ROUND(avg_hours::NUMERIC, 2), 0))
      )
      FROM aggregated_trends
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- PART M: Rewrite get_monthly_muster_data to use config-driven function
-- Same logic — replaces hardcoded role_id IN (...) blocks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_monthly_muster_data(
  start_date_iso  TEXT,
  end_date_iso    TEXT,
  user_ids_array  UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result   JSONB;
  start_dt DATE := start_date_iso::DATE;
  end_dt   DATE := end_date_iso::DATE;
BEGIN
  WITH user_date_matrix AS (
    SELECT u.id AS user_id, u.name AS user_name,
           public.resolve_user_staff_category(u.role_id) AS staff_cat,
           d.day::DATE
    FROM public.users u
    CROSS JOIN generate_series(start_dt, end_dt, '1 day'::INTERVAL) AS d(day)
    WHERE u.id = ANY(user_ids_array)
  ),
  daily_events AS (
    SELECT user_id,
           "timestamp"::DATE AS event_date,
           MIN(CASE WHEN type IN ('check-in', 'punch-in', 'Site In') THEN "timestamp" END) AS first_check_in,
           MAX(CASE WHEN type IN ('check-out', 'punch-out', 'Site Out') THEN "timestamp" END) AS last_check_out
    FROM public.attendance_events
    WHERE "timestamp"::DATE BETWEEN start_dt AND end_dt
      AND user_id = ANY(user_ids_array)
    GROUP BY user_id, event_date
  ),
  daily_status AS (
    SELECT
      udm.user_id,
      udm.user_name,
      udm.day,
      CASE
        WHEN lr.id IS NOT NULL THEN
          CASE
            WHEN lr.leave_type = 'WFH'     THEN 'P'
            WHEN lr.day_option = 'half'     THEN 'HL'
            ELSE                                 'L'
          END
        WHEN h.id IS NOT NULL    THEN 'H'
        WHEN EXTRACT(DOW FROM udm.day) = ANY(
          ARRAY(
            SELECT value::INT
            FROM jsonb_array_elements_text(
              COALESCE(s.attendance_settings->udm.staff_cat->'weeklyOffDays', '[0]'::jsonb)
            )
          )
        )                        THEN 'WO'
        WHEN de.first_check_in IS NOT NULL THEN
          CASE
            WHEN de.last_check_out IS NULL AND udm.day = end_dt THEN 'P'
            WHEN de.last_check_out IS NULL AND udm.day < end_dt  THEN 'A'
            WHEN (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0)
                 >= (s.attendance_settings->udm.staff_cat->>'minimumHoursFullDay')::NUMERIC THEN 'P'
            WHEN (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0)
                 >= (s.attendance_settings->udm.staff_cat->>'minimumHoursHalfDay')::NUMERIC THEN 'HD'
            ELSE 'SH'
          END
        ELSE 'A'
      END AS status_code
    FROM user_date_matrix udm
    LEFT JOIN daily_events de ON udm.user_id = de.user_id AND udm.day = de.event_date
    LEFT JOIN public.leave_requests lr
      ON udm.user_id = lr.user_id
      AND lr.status = 'approved'
      AND udm.day BETWEEN lr.start_date AND lr.end_date
    LEFT JOIN public.holidays h
      ON udm.day = h.date
      AND h.type = udm.staff_cat
    CROSS JOIN public.settings s
    WHERE s.id = 'singleton'
  ),
  user_daily_statuses AS (
    SELECT
      user_id,
      user_name,
      jsonb_agg(
        jsonb_build_object('date', TO_CHAR(day, 'YYYY-MM-DD'), 'status', status_code)
        ORDER BY day
      ) AS daily_statuses
    FROM daily_status
    GROUP BY user_id, user_name
  )
  SELECT jsonb_agg(
    jsonb_build_object('userId', user_id, 'userName', user_name, 'dailyStatuses', daily_statuses)
  )
  INTO result
  FROM user_daily_statuses;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- PART N: update_at triggers for new tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'travel_rules_config',
    'travel_logs',
    'reimbursement_claims',
    'payroll_snapshots',
    'attendance_daily_status_log',
    'rule_inheritance_cache'
  ] LOOP
    EXECUTE FORMAT(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I;
       CREATE TRIGGER trg_set_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- PART O: Auto-invalidate rule cache when attendance_settings_scopes changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_invalidate_rule_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.invalidate_rule_cache_for_scope(
    COALESCE(NEW.scope_type, OLD.scope_type),
    COALESCE(NEW.scope_id,   OLD.scope_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_scope_change ON public.attendance_settings_scopes;
CREATE TRIGGER trg_invalidate_cache_on_scope_change
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_settings_scopes
  FOR EACH ROW EXECUTE FUNCTION public.trg_invalidate_rule_cache();

-- Also invalidate on global settings change
CREATE OR REPLACE FUNCTION public.trg_invalidate_all_rule_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Global settings changed — nuke the entire cache
  DELETE FROM public.rule_inheritance_cache;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidate_cache_on_settings_change ON public.settings;
CREATE TRIGGER trg_invalidate_cache_on_settings_change
  AFTER UPDATE OF attendance_settings ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_invalidate_all_rule_cache();

-- =============================================================================
-- END OF MIGRATION 20260627_001
-- Summary of changes:
--   A. attendance_settings_scopes — extended scope_type CHECK (non-breaking)
--   B. attendance_rule_versions  — added scope_type CHECK (non-breaking)
--   C. rule_inheritance_cache    — NEW table + RLS + auto-invalidation triggers
--   D. users                     — 5 new nullable columns (non-breaking)
--   E. site_staff_config         — 7 new nullable columns (non-breaking)
--   F. travel_rules_config       — NEW table + RLS + global seed row
--   G. travel_logs               — NEW table + RLS
--   H. reimbursement_claims      — NEW table + RLS
--   I. payroll_snapshots         — NEW table + RLS
--   J. attendance_daily_status_log — NEW table + RLS
--   K. resolve_user_staff_category() — NEW config-driven SQL function
--   L. get_attendance_dashboard_data() — REPLACED with config-driven version
--   M. get_monthly_muster_data()       — REPLACED with config-driven version
--   N. updated_at triggers for all new tables
--   O. Cache invalidation triggers on scope/settings changes
-- =============================================================================
