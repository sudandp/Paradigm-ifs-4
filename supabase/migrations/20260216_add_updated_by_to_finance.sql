-- Migration to add updated_by tracking columns to site_finance_tracker
-- Description: Adds updated_by (UUID) and updated_by_name (TEXT) columns.

DO $$ 
BEGIN
    -- 1. Add updated_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'updated_by') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- 2. Add updated_by_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'updated_by_name') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN updated_by_name TEXT;
    END IF;

END $$;
