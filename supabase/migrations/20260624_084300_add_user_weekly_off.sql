-- Add weekly_off_days column to users table
ALTER TABLE users ADD COLUMN weekly_off_days JSONB DEFAULT NULL;
