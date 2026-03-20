-- Migration: Add user tracking columns to site_finance_tracker
-- Description: Adds created_by (UUID) and created_by_name (TEXT) to track who created the record.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'created_by') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'created_by_name') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN created_by_name TEXT;
    END IF;
END $$;
