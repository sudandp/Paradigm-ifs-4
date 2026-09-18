-- ============================================================================
-- Migration: Drop incorrect UNIQUE constraint on onboarding_submissions.created_user_id
-- Date: 2026-09-18
--
-- Problem: A UNIQUE constraint on created_user_id prevented any field officer,
-- HR personnel, or admin from creating more than one onboarding submission,
-- causing all subsequent submissions to fail with duplicate key violation (23505)
-- and get stuck in the offline outbox / fail sync to the server database.
-- ============================================================================

ALTER TABLE public.onboarding_submissions 
DROP CONSTRAINT IF EXISTS onboarding_submissions_created_user_id_key;

-- Replace with a normal, non-unique performance index
CREATE INDEX IF NOT EXISTS idx_onboarding_submissions_created_user_id 
ON public.onboarding_submissions(created_user_id);
