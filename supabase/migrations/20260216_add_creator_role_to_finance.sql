-- Migration: Add creator_role column to site_finance_tracker
-- Description: Adds created_by_role (TEXT) to track the role of the person who created the record.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'created_by_role') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN created_by_role TEXT;
    END IF;
END $$;
