-- Migration: Fix Tracker Site ID Type
-- Date: 2026-02-17
-- Description: Changes site_id column from UUID to TEXT in site_invoice_tracker and site_finance_tracker 
-- to accommodate string site codes from organizations table.

DO $$ 
BEGIN
    -- 1. Fix site_invoice_tracker
    -- Drop the foreign key constraint if it exists (it references public.locations(id) which is UUID)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'site_invoice_tracker_site_id_fkey') THEN
        ALTER TABLE public.site_invoice_tracker DROP CONSTRAINT site_invoice_tracker_site_id_fkey;
    END IF;

    -- Change column type from UUID to TEXT
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_tracker' AND column_name = 'site_id' AND data_type = 'uuid') THEN
        ALTER TABLE public.site_invoice_tracker ALTER COLUMN site_id TYPE TEXT USING site_id::text;
    END IF;

    -- 2. Fix site_finance_tracker
    -- Drop the foreign key constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'site_finance_tracker_site_id_fkey') THEN
        ALTER TABLE public.site_finance_tracker DROP CONSTRAINT site_finance_tracker_site_id_fkey;
    END IF;

    -- Change column type from UUID to TEXT
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'site_id' AND data_type = 'uuid') THEN
        ALTER TABLE public.site_finance_tracker ALTER COLUMN site_id TYPE TEXT USING site_id::text;
    END IF;

END $$;
