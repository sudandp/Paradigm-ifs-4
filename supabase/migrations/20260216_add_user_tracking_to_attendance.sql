-- Migration: Add user tracking and soft delete to site_invoice_tracker
-- Description: Adds created_by_role, deleted_at, deleted_by, deleted_by_name, and deleted_reason.

DO $$ 
BEGIN
    -- 1. Add created_by_role if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'created_by_role') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN created_by_role TEXT;
    END IF;

    -- 2. Add soft-delete columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'deleted_at') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'deleted_by') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'deleted_by_name') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN deleted_by_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'deleted_reason') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN deleted_reason TEXT;
    END IF;
END $$;
