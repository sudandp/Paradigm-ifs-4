-- Migration: Add eligible_roles and name columns to recurring_holidays table
-- Purpose: Allow recurring holidays (e.g. 3rd Saturday Blue Leave) to be restricted
--          to specific role IDs only. If eligible_roles is empty/null, the holiday
--          applies to ALL roles in the category (backwards-compatible behaviour).

ALTER TABLE recurring_holidays
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS eligible_roles jsonb DEFAULT '[]'::jsonb;

-- Index for performance (optional but recommended for large deployments)
CREATE INDEX IF NOT EXISTS idx_recurring_holidays_eligible_roles
  ON recurring_holidays USING gin (eligible_roles);

COMMENT ON COLUMN recurring_holidays.name IS 'Optional display name for the recurring holiday rule (e.g. Blue Leave, Pink Leave)';
COMMENT ON COLUMN recurring_holidays.eligible_roles IS 'JSONB array of role_id strings. If empty, all roles in role_type category are eligible. If populated, only listed roles qualify for BL/PL instead of W/O.';
