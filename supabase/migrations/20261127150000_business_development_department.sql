-- ============================================================================
-- Business Development as its own department
-- Date: 2026-11-27
-- Builds on: 20261127140000_department_responsibility_scoping.sql
--
-- business_developer / business_developer_copy were auto-mapped to
-- 'operations'. BD is a separate department with its own director checkbox.
-- Safe whether or not 20261127140000 has already been applied.
-- ============================================================================

-- 1. Allow the new value in both CHECK constraints (drop + recreate)
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_department_check;
ALTER TABLE public.roles ADD CONSTRAINT roles_department_check
  CHECK (department IS NULL OR department IN
    ('finance', 'operations', 'field_staff', 'site_staff', 'hr', 'business_development'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_responsibility_areas_check;
ALTER TABLE public.users ADD CONSTRAINT users_responsibility_areas_check
  CHECK (responsibility_areas <@ ARRAY
    ['finance', 'operations', 'field_staff', 'site_staff', 'hr', 'business_development']::text[]);

-- 2. Move BD roles out of Operations (or fill if still empty).
--    Roles an admin deliberately set to another department are left alone.
UPDATE public.roles
SET department = 'business_development'
WHERE id ~* '(business_develop|^bd$|^bd_|_bd$)'
  AND (department IS NULL OR department = 'operations');
