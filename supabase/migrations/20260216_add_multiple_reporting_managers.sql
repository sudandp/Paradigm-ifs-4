-- Add Reporting Manager 2 and Reporting Manager 3 columns to users table
-- These allow each employee to have up to 3 reporting managers for parallel approval

ALTER TABLE users
ADD COLUMN IF NOT EXISTS reporting_manager_2_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reporting_manager_3_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_2 ON users(reporting_manager_2_id);
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_3 ON users(reporting_manager_3_id);
