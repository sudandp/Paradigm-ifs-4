-- FCU (Field Check Unit) Verification Columns for onboarding_submissions
-- Run this in Supabase SQL Editor

ALTER TABLE onboarding_submissions
  ADD COLUMN IF NOT EXISTS fcu_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fcu_acknowledged_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fcu_acknowledged_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fcu_verified_by TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fcu_verified_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fcu_notes TEXT DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN onboarding_submissions.fcu_status IS 'FCU verification status: null (not started), pending, verified, failed';
COMMENT ON COLUMN onboarding_submissions.fcu_acknowledged_by IS 'Name of HR who acknowledged the AI verification and started FCU';
COMMENT ON COLUMN onboarding_submissions.fcu_acknowledged_at IS 'Timestamp when FCU was initiated';
COMMENT ON COLUMN onboarding_submissions.fcu_verified_by IS 'Name of person who completed FCU verification';
COMMENT ON COLUMN onboarding_submissions.fcu_verified_at IS 'Timestamp when FCU verification was completed';
COMMENT ON COLUMN onboarding_submissions.fcu_notes IS 'Notes from FCU verification (e.g., failure reason)';
