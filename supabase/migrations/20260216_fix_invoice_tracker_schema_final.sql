-- Consolidated Migration: Finalizing Site Invoice Tracker Schema
-- Description: Ensures all columns for attendance tracking, invoice status, user tracking, and soft delete are present.
-- Run this in the Supabase SQL Editor if you see 400 Bad Request errors for site_invoice_tracker.

DO $$ 
BEGIN
    -- 1. Add basic tracking columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'created_by') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'created_by_name') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN created_by_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'created_by_role') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN created_by_role TEXT;
    END IF;

    -- 2. Add soft-delete columns if missing
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

    -- 3. Ensure all remarks and status columns exist (from original migration but good to be safe)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'ops_remarks') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN ops_remarks TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'hr_remarks') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN hr_remarks TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'finance_remarks') THEN
        ALTER TABLE site_invoice_tracker ADD COLUMN finance_remarks TEXT;
    END IF;

END $$;
