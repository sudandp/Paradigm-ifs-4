-- Migration: Add status to site_finance_tracker
-- Description: Adds a status column for tracking approval state (pending, approved, invoiced).

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'status') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;
