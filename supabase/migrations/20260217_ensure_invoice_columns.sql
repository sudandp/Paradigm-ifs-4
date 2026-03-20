-- Migration: Ensure Created By and Billing Year columns exist in site_invoice_defaults
-- Date: 2026-02-17
-- Description: Ensures the site_invoice_defaults table has the necessary columns for tracking and filtering.

DO $$ 
BEGIN
    -- 1. Ensure created_by column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'created_by') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- 2. Ensure created_by_name column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'created_by_name') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN created_by_name TEXT;
    END IF;

    -- 3. Ensure billing_year column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'billing_year') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN billing_year INTEGER;
    END IF;

    -- 4. Ensure contract columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'contract_amount') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN contract_amount DECIMAL(12, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'contract_management_fee') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN contract_management_fee DECIMAL(12, 2) DEFAULT 0;
    END IF;

END $$;
