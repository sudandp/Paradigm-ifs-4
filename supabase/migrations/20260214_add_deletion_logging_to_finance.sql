-- Migration: Add deletion logging columns to site_finance_tracker
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'deleted_at') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'deleted_by') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'deleted_by_name') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN deleted_by_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'deleted_reason') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN deleted_reason TEXT;
    END IF;
END $$;
