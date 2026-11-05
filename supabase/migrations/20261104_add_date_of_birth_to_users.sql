-- Migration: Add date_of_birth column to public.users and backfill known dates
-- Date: 2026-11-04

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS date_of_birth DATE;

COMMENT ON COLUMN public.users.date_of_birth IS 'Official employee / user date of birth (DOB)';

-- Backfill from verified insurance submissions (GMC forms)
UPDATE public.users u
SET date_of_birth = gmc.dob
FROM public.gmc_form_submissions gmc
WHERE (
    RIGHT(REGEXP_REPLACE(COALESCE(u.phone, ''), '\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(COALESCE(gmc.contact_number, ''), '\D', '', 'g'), 10)
    OR LOWER(TRIM(u.name)) = LOWER(TRIM(gmc.employee_name))
) 
AND gmc.dob IS NOT NULL
AND u.date_of_birth IS NULL;

