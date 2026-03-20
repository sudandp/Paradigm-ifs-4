-- Migration: Reset All Violations for All Users
-- Date: 2026-03-15
-- Description: This script resets all pending/escalated attendance violations for all users
-- and clears any salary holds applied to their accounts.

BEGIN;

-- 1. Reset all field attendance violations
UPDATE public.field_attendance_violations
SET 
    status = 'acknowledged',
    manager_notes = 'Batch reset by Admin'
WHERE 
    status IN ('pending', 'escalated');





-- 3. Remove all salary holds for users
UPDATE public.users
SET 
    salary_hold = false,
    salary_hold_reason = 'Violations reset by Admin'
WHERE 
    salary_hold = true;

COMMIT;
