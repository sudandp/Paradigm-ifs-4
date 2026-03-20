-- Consolidated Migration: Finalizing Site Finance Tracker Schema
-- Description: Ensures all columns for contract details, billed amounts, and user tracking are present.
-- Run this in the Supabase SQL Editor if you see 400 Bad Request errors.

DO $$ 
BEGIN
    -- 1. Rename management_fee to contract_management_fee if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'management_fee') THEN
        ALTER TABLE site_finance_tracker RENAME COLUMN management_fee TO contract_management_fee;
    END IF;

    -- 2. Add billed columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'billed_amount') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN billed_amount DECIMAL(12, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'billed_management_fee') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN billed_management_fee DECIMAL(12, 2) DEFAULT 0;
    END IF;

    -- 3. Add user tracking columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'created_by') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'created_by_name') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN created_by_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'created_by_role') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN created_by_role TEXT;
    END IF;

    -- 4. Clean up legacy columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'variation_amount') THEN
        ALTER TABLE site_finance_tracker DROP COLUMN variation_amount;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'penalty_amount') THEN
        ALTER TABLE site_finance_tracker DROP COLUMN penalty_amount;
    END IF;

    -- 5. Update the total_billed_amount generated column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'total_billing_amount') THEN
        ALTER TABLE site_finance_tracker DROP COLUMN total_billing_amount;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'total_billed_amount') THEN
        ALTER TABLE site_finance_tracker DROP COLUMN total_billed_amount;
    END IF;

    ALTER TABLE site_finance_tracker ADD COLUMN total_billed_amount DECIMAL(12, 2) GENERATED ALWAYS AS (billed_amount + billed_management_fee) STORED;

END $$;
