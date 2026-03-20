-- Update check_is_admin() to include operation_manager and developer
-- Migration: 20260119_fix_ops_manager_visibility.sql

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = (select auth.uid()) 
    AND role_id IN ('admin', 'hr', 'super_admin', 'operation_manager', 'developer')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
