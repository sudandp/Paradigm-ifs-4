-- Migration: Complete Site Management Persistence Tables
-- Date: 2026-01-24
-- Description: Adds tables for Assignments, Assets, Tools, and Manpower Costing.

-- 1. Site Assignments
CREATE TABLE IF NOT EXISTS public.site_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    officer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    site_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(officer_id, site_id, assignment_date)
);

-- 2. Site Assets
CREATE TABLE IF NOT EXISTS public.site_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
    assets JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Site Issued Tools
CREATE TABLE IF NOT EXISTS public.site_issued_tools (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
    tools JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4. Site Manpower (Costing)
CREATE TABLE IF NOT EXISTS public.site_manpower (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
    manpower_details JSONB DEFAULT '[]'::jsonb,
    service_charge_percentage NUMERIC DEFAULT 10,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_issued_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_manpower ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies (Admin manage, Auth select)
-- Assignments
CREATE POLICY "site_assignments_select" ON public.site_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "site_assignments_write" ON public.site_assignments FOR ALL USING (public.check_is_admin());

-- Assets
CREATE POLICY "site_assets_select" ON public.site_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "site_assets_write" ON public.site_assets FOR ALL USING (public.check_is_admin());

-- Tools
CREATE POLICY "site_issued_tools_select" ON public.site_issued_tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "site_issued_tools_write" ON public.site_issued_tools FOR ALL USING (public.check_is_admin());

-- Manpower
CREATE POLICY "site_manpower_select" ON public.site_manpower FOR SELECT TO authenticated USING (true);
CREATE POLICY "site_manpower_write" ON public.site_manpower FOR ALL USING (public.check_is_admin());
