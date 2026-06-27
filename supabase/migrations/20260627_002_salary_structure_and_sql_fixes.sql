-- =============================================================================
-- MIGRATION 20260627_002 — Salary Structure Config + SQL Bug Fixes
--
-- Changes:
--   A. salary_structure_config   — NEW table for statutory payroll rates
--   B. resolve_user_staff_category() — FIXED: space-padded role ID bug
--   C. RLS for salary_structure_config
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PART A: salary_structure_config
-- Stores EPF/ESIC/PT/Bonus/Gratuity rates per state per effective date.
-- payrollEngine reads the latest row WHERE effective_from <= payroll_month.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.salary_structure_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state                   TEXT NOT NULL DEFAULT 'KA',
  effective_from          DATE NOT NULL,

  -- EPF (Employees Provident Fund)
  epf_employee_rate       NUMERIC(6,5) NOT NULL DEFAULT 0.12000,
  epf_employer_rate       NUMERIC(6,5) NOT NULL DEFAULT 0.12000,
  epf_eps_rate            NUMERIC(6,5) NOT NULL DEFAULT 0.08330,
  epf_edli_rate           NUMERIC(6,5) NOT NULL DEFAULT 0.00500,
  epf_admin_charge_rate   NUMERIC(6,5) NOT NULL DEFAULT 0.00500,
  epf_wage_ceiling        NUMERIC(10,2) NOT NULL DEFAULT 15000.00,

  -- ESIC (Employees State Insurance)
  esic_employee_rate      NUMERIC(6,5) NOT NULL DEFAULT 0.00750,
  esic_employer_rate      NUMERIC(6,5) NOT NULL DEFAULT 0.03250,
  esic_wage_ceiling       NUMERIC(10,2) NOT NULL DEFAULT 21000.00,

  -- Professional Tax slabs JSONB: [{upTo, monthlyPT, description}]
  -- upTo: null = highest band (no upper limit)
  pt_slabs                JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Payment of Bonus Act 1965
  bonus_rate_min          NUMERIC(6,5) NOT NULL DEFAULT 0.08330,
  bonus_rate_max          NUMERIC(6,5) NOT NULL DEFAULT 0.20000,
  bonus_wage_ceiling      NUMERIC(10,2) NOT NULL DEFAULT 21000.00,
  bonus_calc_ceiling      NUMERIC(10,2) NOT NULL DEFAULT 7000.00,

  -- Payment of Gratuity Act 1972
  gratuity_rate           NUMERIC(6,5) NOT NULL DEFAULT 0.57692,  -- 15/26
  gratuity_min_years      NUMERIC(4,2) NOT NULL DEFAULT 5.00,

  -- Karnataka Minimum Wages (Zone A, per month)
  min_wage_unskilled      NUMERIC(10,2),
  min_wage_semi_skilled   NUMERIC(10,2),
  min_wage_skilled        NUMERIC(10,2),
  min_wage_highly_skilled NUMERIC(10,2),
  min_wage_clerical       NUMERIC(10,2),

  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (state, effective_from)
);

COMMENT ON TABLE public.salary_structure_config IS
  'Statutory payroll rates (EPF, ESIC, PT, Bonus, Gratuity) per state and effective date. '
  'payrollEngine reads the latest row with effective_from <= payroll month. '
  'Never hardcode statutory rates in application code.';

DROP TRIGGER IF EXISTS trg_set_updated_at_salary_structure ON public.salary_structure_config;
CREATE TRIGGER trg_set_updated_at_salary_structure
  BEFORE UPDATE ON public.salary_structure_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- SEED: Karnataka statutory rates effective 2024-01-01
-- Sources: EPF Act 1952, ESIC Act 1948, KA PT Act 1976, Bonus Act 1965,
--          Gratuity Act 1972, KA Min Wages Gazette (Zone A approximate)
-- ---------------------------------------------------------------------------

INSERT INTO public.salary_structure_config (
  state, effective_from,
  epf_employee_rate, epf_employer_rate, epf_eps_rate,
  epf_edli_rate, epf_admin_charge_rate, epf_wage_ceiling,
  esic_employee_rate, esic_employer_rate, esic_wage_ceiling,
  pt_slabs,
  bonus_rate_min, bonus_rate_max, bonus_wage_ceiling, bonus_calc_ceiling,
  gratuity_rate, gratuity_min_years,
  min_wage_unskilled, min_wage_semi_skilled, min_wage_skilled,
  min_wage_highly_skilled, min_wage_clerical,
  notes
) VALUES (
  'KA', '2024-01-01',
  0.12000, 0.12000, 0.08330, 0.00500, 0.00500, 15000.00,
  0.00750, 0.03250, 21000.00,
  '[
    {"upTo": 9999,  "monthlyPT": 0,   "description": "Up to Rs.9,999 - Nil"},
    {"upTo": 14999, "monthlyPT": 150, "description": "Rs.10,000 to Rs.14,999 - Rs.150"},
    {"upTo": 29999, "monthlyPT": 200, "description": "Rs.15,000 to Rs.29,999 - Rs.200"},
    {"upTo": null,  "monthlyPT": 200, "description": "Rs.30,000 and above - Rs.200"}
  ]'::jsonb,
  0.08330, 0.20000, 21000.00, 7000.00,
  0.57692, 5.00,
  11000.00, 12500.00, 14000.00, 17000.00, 15000.00,
  'Karnataka 2024 defaults. Verify min wages from official KA gazette before payroll.'
)
ON CONFLICT (state, effective_from) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PART B: Fix resolve_user_staff_category()
--
-- BUG in 20260627_001: hardcoded fallback used space-padded role name strings
-- (e.g. 'field staff', 'hr ops') which will never match actual slug values
-- stored in the roles table (which use lowercase-no-space slugs).
--
-- FIX: Replace the hardcoded IN (...) list with TRIM(LOWER()) ILIKE keyword
-- matching against both slug and name columns, which handles any casing or
-- spacing differences gracefully.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.resolve_user_staff_category(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_user_staff_category(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.resolve_user_staff_category(p_role_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_slug        TEXT;
  v_role_name        TEXT;
  v_category_mapping JSONB;
BEGIN
  -- PRIORITY 1: Config-driven mapping from settings.attendance_settings.roleMapping
  -- Structure: { "field": ["uuid1","uuid2"], "site": [...], "office": [...] }
  SELECT attendance_settings -> 'roleMapping'
  INTO v_category_mapping
  FROM public.settings
  WHERE id = 'singleton';

  IF v_category_mapping IS NOT NULL AND jsonb_typeof(v_category_mapping) = 'object' THEN
    IF v_category_mapping -> 'field' @> to_jsonb(p_role_id) THEN RETURN 'field'; END IF;
    IF v_category_mapping -> 'site' @> to_jsonb(p_role_id) THEN RETURN 'site'; END IF;
    IF v_category_mapping -> 'management' @> to_jsonb(p_role_id) THEN RETURN 'management'; END IF;
    IF v_category_mapping -> 'admin' @> to_jsonb(p_role_id) THEN RETURN 'admin'; END IF;
    IF v_category_mapping -> 'office' @> to_jsonb(p_role_id) THEN RETURN 'office'; END IF;
  END IF;

  -- PRIORITY 2: Keyword match on role id / display_name (TRIM + LOWER safe)
  SELECT
    TRIM(LOWER(COALESCE(id, ''))),
    TRIM(LOWER(COALESCE(display_name, '')))
  INTO v_role_slug, v_role_name
  FROM public.roles
  WHERE id = p_role_id;

  -- No role found — default to office
  IF v_role_slug IS NULL THEN RETURN 'office'; END IF;

  -- Field staff
  IF v_role_slug ILIKE '%field%'    OR v_role_name ILIKE '%field%'
  OR v_role_slug ILIKE '%driver%'   OR v_role_name ILIKE '%driver%'
  OR v_role_slug ILIKE '%delivery%' OR v_role_name ILIKE '%delivery%'
  OR v_role_slug ILIKE '%sales%'    OR v_role_name ILIKE '%sales%'
  THEN RETURN 'field'; END IF;

  -- Site staff (security, housekeeping, facility)
  IF v_role_slug ILIKE '%guard%'     OR v_role_name ILIKE '%guard%'
  OR v_role_slug ILIKE '%security%'  OR v_role_name ILIKE '%security%'
  OR v_role_slug ILIKE '%housekeep%' OR v_role_name ILIKE '%housekeep%'
  OR v_role_slug ILIKE '%facility%'  OR v_role_name ILIKE '%facility%'
  OR v_role_slug ILIKE '%reliever%'  OR v_role_name ILIKE '%reliever%'
  OR v_role_slug ILIKE '%site%'      OR v_role_name ILIKE '%site%staff%'
  THEN RETURN 'site'; END IF;

  -- Management
  IF v_role_slug ILIKE '%manager%'  OR v_role_name ILIKE '%manager%'
  OR v_role_slug ILIKE '%director%' OR v_role_name ILIKE '%director%'
  OR v_role_slug ILIKE '%ceo%'      OR v_role_name ILIKE '%ceo%'
  OR v_role_slug ILIKE '%head%'     OR v_role_name ILIKE '%head%'
  THEN RETURN 'management'; END IF;

  -- Admin / developer
  IF v_role_slug ILIKE '%admin%'     OR v_role_name ILIKE '%admin%'
  OR v_role_slug ILIKE '%developer%' OR v_role_name ILIKE '%developer%'
  OR v_role_slug ILIKE '%hr%'        OR v_role_name ILIKE '%human%resource%'
  OR v_role_slug ILIKE '%ops%'       OR v_role_name ILIKE '%operations%'
  THEN RETURN 'admin'; END IF;

  -- Default
  RETURN 'office';
END;
$$;

COMMENT ON FUNCTION public.resolve_user_staff_category(TEXT) IS
  'FIXED 20260627_002: Replaces buggy hardcoded space-padded role ID fallback. '
  'Priority: 1) settings roleMapping UUID lookup, 2) ILIKE keyword on slug+display_name, 3) default=office.';

-- ---------------------------------------------------------------------------
-- PART C: RLS for salary_structure_config
-- ---------------------------------------------------------------------------

ALTER TABLE public.salary_structure_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salary_config_select_policy" ON public.salary_structure_config;
CREATE POLICY "salary_config_select_policy"
  ON public.salary_structure_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND (
          r.id IN ('developer', 'super_admin', 'admin')
          OR r.display_name ILIKE '%hr%'
          OR r.display_name ILIKE '%payroll%'
          OR r.display_name ILIKE '%manager%'
          OR r.display_name ILIKE '%director%'
        )
    )
  );

DROP POLICY IF EXISTS "salary_config_write_policy" ON public.salary_structure_config;
CREATE POLICY "salary_config_write_policy"
  ON public.salary_structure_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = auth.uid()
        AND r.id IN ('developer', 'super_admin')
    )
  );

-- =============================================================================
-- END OF MIGRATION 20260627_002
-- Summary:
--   A. salary_structure_config — NEW table, Karnataka 2024 defaults seeded
--   B. resolve_user_staff_category() — FIXED TRIM/LOWER safe keyword match
--   C. RLS for salary_structure_config
-- =============================================================================
