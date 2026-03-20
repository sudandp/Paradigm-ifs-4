-- Migration: Fix Organizational Structure RLS
-- Date: 2026-01-24
-- Description: Enables RLS and adds policies for organization_groups, companies, and entities.

-- 1. Enable RLS on organizational structure tables
ALTER TABLE IF EXISTS public.organization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.entities ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for Organization Groups
DROP POLICY IF EXISTS "org_groups_select" ON public.organization_groups;
DROP POLICY IF EXISTS "org_groups_write" ON public.organization_groups;

CREATE POLICY "org_groups_select" ON public.organization_groups 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "org_groups_write" ON public.organization_groups 
FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

-- 3. Create policies for Companies
DROP POLICY IF EXISTS "companies_select" ON public.companies;
DROP POLICY IF EXISTS "companies_write" ON public.companies;

CREATE POLICY "companies_select" ON public.companies 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "companies_write" ON public.companies 
FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());

-- 4. Create policies for Entities (Clients)
DROP POLICY IF EXISTS "entities_select" ON public.entities;
DROP POLICY IF EXISTS "entities_write" ON public.entities;

CREATE POLICY "entities_select" ON public.entities 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "entities_write" ON public.entities 
FOR ALL USING (public.check_is_admin()) WITH CHECK (public.check_is_admin());
