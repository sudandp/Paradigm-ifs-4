-- Migration: Final Fix for Roles RLS and check_is_admin
-- Date: 2026-01-08
-- Description: Standardizes check_is_admin logic and ensures roles table is accessible to admins.

-- 1. Corrected check_is_admin function (Fixed syntax error)
-- This function decides who can perform administrative actions like updating roles or managing other users.
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (select auth.uid()) 
    AND (
        LOWER(REPLACE(role_id, '_', ' ')) IN ('admin', 'hr', 'super admin', 'superadmin')
        OR role_id IN ('admin', 'hr', 'super_admin', 'superadmin')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 2. Restructure Roles RLS
-- Allows all authenticated users to SEE roles, but only admins to CHANGE them.
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
DROP POLICY IF EXISTS "roles_insert_policy" ON public.roles;
DROP POLICY IF EXISTS "roles_update_policy" ON public.roles;
DROP POLICY IF EXISTS "roles_delete_policy" ON public.roles;

CREATE POLICY "roles_select_policy" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_insert_policy" ON public.roles FOR INSERT TO authenticated WITH CHECK (public.check_is_admin());
CREATE POLICY "roles_update_policy" ON public.roles FOR UPDATE TO authenticated USING (public.check_is_admin());
CREATE POLICY "roles_delete_policy" ON public.roles FOR DELETE TO authenticated USING (public.check_is_admin());

-- 3. Grant table permissions
GRANT ALL ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;

-- 4. Ensure fundamental permissions exist for all roles to prevent "Access Denied" on login
-- This appends 'view_profile' and 'view_own_attendance' only if they aren't already present.
UPDATE public.roles SET permissions = array_cat(permissions, '{view_profile, view_own_attendance}')
WHERE NOT permissions @> '{view_profile}';
