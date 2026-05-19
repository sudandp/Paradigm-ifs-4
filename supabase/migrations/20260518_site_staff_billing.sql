CREATE TABLE IF NOT EXISTS public.site_staff_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ctc_per_month NUMERIC NOT NULL DEFAULT 0,
  weekly_offs_per_week NUMERIC NOT NULL DEFAULT 0,
  earned_leaves_per_annum INTEGER NOT NULL DEFAULT 0,
  nfh_per_annum INTEGER NOT NULL DEFAULT 0,
  nh_billing_config TEXT NOT NULL DEFAULT 'NA',
  nh_salary_config TEXT NOT NULL DEFAULT 'NA',
  shift TEXT NOT NULL DEFAULT 'A',
  shift_hours INTEGER NOT NULL DEFAULT 8,
  per_day_billing_rate NUMERIC,
  rate_effective_date DATE,
  per_annum_rate NUMERIC,
  billable_duties_in_year NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.lumpsum_billing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  rate_per_month NUMERIC NOT NULL,
  billing_type TEXT NOT NULL DEFAULT 'Lumpsum',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
