-- Migration: Fix Site Finance Tracker Schema Complete
-- Date: 2026-02-17
-- Description: Consolidated fix for site_finance_tracker table. 
-- Ensures all columns match the frontend expectations and handles previous partial migrations.

DO $$ 
BEGIN
    -- 1. Fix site_id type (UUID -> TEXT)
    -- Drop the foreign key constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'site_finance_tracker_site_id_fkey') THEN
        ALTER TABLE public.site_finance_tracker DROP CONSTRAINT site_finance_tracker_site_id_fkey;
    END IF;

    -- Change column type from UUID to TEXT
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'site_id' AND data_type = 'uuid') THEN
        ALTER TABLE public.site_finance_tracker ALTER COLUMN site_id TYPE TEXT USING site_id::text;
    END IF;

    -- 2. Rename management_fee to contract_management_fee if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'management_fee') THEN
        ALTER TABLE public.site_finance_tracker RENAME COLUMN management_fee TO contract_management_fee;
    END IF;

    -- 3. Add missing Billed Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'billed_amount') THEN
        ALTER TABLE public.site_finance_tracker ADD COLUMN billed_amount DECIMAL(12, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'billed_management_fee') THEN
        ALTER TABLE public.site_finance_tracker ADD COLUMN billed_management_fee DECIMAL(12, 2) DEFAULT 0;
    END IF;

    -- 4. Add or Verify User Tracking Columns (Creator)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'created_by') THEN
        ALTER TABLE public.site_finance_tracker ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'created_by_name') THEN
        ALTER TABLE public.site_finance_tracker ADD COLUMN created_by_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'created_by_role') THEN
        ALTER TABLE public.site_finance_tracker ADD COLUMN created_by_role TEXT;
    END IF;

    -- 5. Add or Verify User Tracking Columns (Updater)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'updated_by') THEN
        ALTER TABLE public.site_finance_tracker ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'updated_by_name') THEN
        ALTER TABLE public.site_finance_tracker ADD COLUMN updated_by_name TEXT;
    END IF;

    -- 6. Clean up Legacy Columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'variation_amount') THEN
        ALTER TABLE public.site_finance_tracker DROP COLUMN variation_amount;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'penalty_amount') THEN
        ALTER TABLE public.site_finance_tracker DROP COLUMN penalty_amount;
    END IF;

    -- 7. Fix Generated Column total_billed_amount
    -- Drop old generated columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'total_billing_amount') THEN
        ALTER TABLE public.site_finance_tracker DROP COLUMN total_billing_amount;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'total_billed_amount') THEN
        ALTER TABLE public.site_finance_tracker DROP COLUMN total_billed_amount; -- Drop to recreate properly
    END IF;

    -- Add the correct generated column
    ALTER TABLE public.site_finance_tracker ADD COLUMN total_billed_amount DECIMAL(12, 2) GENERATED ALWAYS AS (billed_amount + billed_management_fee) STORED;

END $$;
