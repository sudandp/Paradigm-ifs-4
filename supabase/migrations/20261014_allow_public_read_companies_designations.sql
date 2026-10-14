-- Migration: Allow public read access to companies, site_staff_designations, and organizations
-- Date: 2026-10-14
-- Purpose: Fix missing options/dropdowns in mobile app (Capacitor Android) during unauthenticated, refreshing, or public enrollment sessions.

-- 1. Companies (Public Read)
DROP POLICY IF EXISTS "public_read_companies" ON public.companies;
CREATE POLICY "public_read_companies" ON public.companies
    FOR SELECT TO anon USING (true);

-- 2. Site Staff Designations (Public Read)
DROP POLICY IF EXISTS "public_read_site_staff_designations" ON public.site_staff_designations;
CREATE POLICY "public_read_site_staff_designations" ON public.site_staff_designations
    FOR SELECT TO anon USING (true);

-- 3. Organizations (Public Read)
DROP POLICY IF EXISTS "public_read_organizations" ON public.organizations;
CREATE POLICY "public_read_organizations" ON public.organizations
    FOR SELECT TO anon USING (true);
