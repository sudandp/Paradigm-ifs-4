-- migrations/site_staff_billing_schema.sql
-- New Schema for Site Staff Calculations (Enterprise Blueprint)

BEGIN;

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Billing Configs (versioned per site per category/designation)
-- Note: 'site_id' and 'category_id' are treated as TEXT or UUID depending on the main schema. 
-- Assuming they are UUIDs for now.
CREATE TABLE IF NOT EXISTS billing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID, -- References your entities or locations
  category_id TEXT, -- E.g. 'HK-SUP', 'SEC-GRD'
  ctc_monthly NUMERIC(10,2) NOT NULL CHECK (ctc_monthly > 0),
  weekly_offs_per_week NUMERIC(3,2) DEFAULT 1 CHECK (weekly_offs_per_week IN (0, 0.5, 1, 2)),
  earned_leaves_pa INT DEFAULT 0 CHECK (earned_leaves_pa IN (0, 18)),
  nfh_pa INT DEFAULT 12 CHECK (nfh_pa IN (0, 10, 12)),
  nh_billing_config TEXT DEFAULT 'NA' CHECK (nh_billing_config IN ('NA','Actuals','Double')),
  nh_salary_config TEXT DEFAULT 'Actuals' CHECK (nh_salary_config IN ('NA','Actuals','Double')),
  billing_unit TEXT DEFAULT 'Per Present' CHECK (billing_unit IN ('Per Present','Lumpsum')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  version_label TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Site Holidays
CREATE TABLE IF NOT EXISTS site_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID,
  holiday_date DATE NOT NULL,
  name TEXT,
  holiday_type TEXT DEFAULT 'National',
  UNIQUE(site_id, holiday_date)
);

-- Leave Balances
CREATE TABLE IF NOT EXISTS leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  el_opening NUMERIC(5,2) DEFAULT 0,
  el_earned_this_month NUMERIC(5,2) DEFAULT 0,
  el_availed_this_month NUMERIC(5,2) DEFAULT 0,
  el_closing NUMERIC(5,2) GENERATED ALWAYS AS 
    (el_opening + el_earned_this_month - el_availed_this_month) STORED,
  wo_opening NUMERIC(5,2) DEFAULT 0,
  wo_earned_this_month NUMERIC(5,2) DEFAULT 0,
  wo_allotted_this_month NUMERIC(5,2) DEFAULT 0,
  wo_closing NUMERIC(5,2) GENERATED ALWAYS AS 
    (wo_opening + wo_earned_this_month - wo_allotted_this_month) STORED,
  UNIQUE(employee_id, year, month)
);

-- Monthly Duty Summary
CREATE TABLE IF NOT EXISTS monthly_duty_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  site_id UUID,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  col_an_net_duties NUMERIC(6,2) DEFAULT 0,
  col_ao_weekoff_ot NUMERIC(6,2) DEFAULT 0,
  col_aq_leave_count NUMERIC(6,2) DEFAULT 0,
  col_ar_absence_count INT DEFAULT 0,
  col_as_ot_duties NUMERIC(6,2) DEFAULT 0,
  col_at_holidays_payable NUMERIC(6,2) DEFAULT 0,
  col_au_total_payable NUMERIC(6,2) DEFAULT 0,
  col_av_final_capped NUMERIC(6,2) DEFAULT 0,
  manual_adjustment NUMERIC(6,2) DEFAULT 0,
  adjustment_reason TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','submitted','client_approved','locked')),
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, billing_period_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_holidays_site_date 
  ON site_holidays(site_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_billing_config_version 
  ON billing_configs(site_id, category_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_monthly_summary_employee_period 
  ON monthly_duty_summary(employee_id, billing_period_start);
CREATE INDEX IF NOT EXISTS idx_leave_balance_lookup 
  ON leave_balances(employee_id, year, month);

COMMIT;
