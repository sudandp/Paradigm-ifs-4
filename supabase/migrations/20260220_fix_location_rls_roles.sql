-- Migration: Fix Location RLS for Managers
-- Date: 2026-02-20
-- Description: Broadens check_is_admin to include all management roles so they can store location data.

-- 1. Update check_is_admin to include all management roles
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (select auth.uid()) 
    AND role_id IN ('admin', 'hr', 'super_admin', 'management', 'field_manager', 'hr_ops', 'ops_manager', 'developer', 'finance', 'site_manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Ensure locations table policies allow these roles
DROP POLICY IF EXISTS "locations_insert_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_update_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_delete_policy" ON public.locations;

CREATE POLICY "locations_insert_policy" ON public.locations FOR INSERT WITH CHECK (public.check_is_admin());
CREATE POLICY "locations_update_policy" ON public.locations FOR UPDATE USING (public.check_is_admin());
CREATE POLICY "locations_delete_policy" ON public.locations FOR DELETE USING (public.check_is_admin());
