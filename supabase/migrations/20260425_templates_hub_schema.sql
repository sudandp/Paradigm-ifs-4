-- Migration: Add missing tables for Templates Hub
-- Date: 2026-04-25

-- 1. Costing & Resources
CREATE TABLE IF NOT EXISTS public.costing_resources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    site_name TEXT,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    cost_centre TEXT,
    unit_type TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    billing_rate NUMERIC NOT NULL DEFAULT 0,
    billing_model TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Back Office ID Series
CREATE TABLE IF NOT EXISTS public.back_office_id_series (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    site_name TEXT,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    permanent_id TEXT NOT NULL,
    temporary_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. GMC Policy Settings
CREATE TABLE IF NOT EXISTS public.gmc_policy_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id TEXT REFERENCES public.companies(id) ON DELETE CASCADE,
    company_name TEXT,
    plan_name TEXT NOT NULL,
    coverage_amount NUMERIC NOT NULL DEFAULT 0,
    premium_amount NUMERIC NOT NULL DEFAULT 0,
    provider TEXT,
    valid_from DATE,
    valid_till DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Master Tools List (Flat version for bulk management)
CREATE TABLE IF NOT EXISTS public.master_tools_list (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    site_name TEXT,
    category TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit TEXT,
    brand TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Add missing columns to site_staff_designations if needed
-- (Assuming we want to keep the existing table but expand it)
ALTER TABLE public.site_staff_designations ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC DEFAULT 0;
ALTER TABLE public.site_staff_designations ADD COLUMN IF NOT EXISTS permanent_id TEXT;
ALTER TABLE public.site_staff_designations ADD COLUMN IF NOT EXISTS temporary_id TEXT;
ALTER TABLE public.site_staff_designations ADD COLUMN IF NOT EXISTS site_name TEXT;
ALTER TABLE public.site_staff_designations ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.costing_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.back_office_id_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmc_policy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_tools_list ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies
CREATE POLICY "costing_resources_all" ON public.costing_resources FOR ALL USING (true);
CREATE POLICY "back_office_id_series_all" ON public.back_office_id_series FOR ALL USING (true);
CREATE POLICY "gmc_policy_settings_all" ON public.gmc_policy_settings FOR ALL USING (true);
CREATE POLICY "master_tools_list_all" ON public.master_tools_list FOR ALL USING (true);
