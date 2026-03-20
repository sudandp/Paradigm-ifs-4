-- Fix foreign key references for created_by column in tracker tables
-- These should reference public.users(id) to allow joins with reporting_manager_id etc.
-- Date: 2026-03-02

DO $$ 
BEGIN
    -- 1. Fix site_invoice_tracker
    -- We need to drop the constraint if it exists. PostgREST usually names it [table]_[column]_fkey
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'site_invoice_tracker' AND constraint_name = 'site_invoice_tracker_created_by_fkey') THEN
        ALTER TABLE public.site_invoice_tracker DROP CONSTRAINT site_invoice_tracker_created_by_fkey;
    END IF;
    
    ALTER TABLE public.site_invoice_tracker 
    ADD CONSTRAINT site_invoice_tracker_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


    -- 2. Fix site_invoice_defaults
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'site_invoice_defaults' AND constraint_name = 'site_invoice_defaults_created_by_fkey') THEN
        ALTER TABLE public.site_invoice_defaults DROP CONSTRAINT site_invoice_defaults_created_by_fkey;
    END IF;
    
    ALTER TABLE public.site_invoice_defaults 
    ADD CONSTRAINT site_invoice_defaults_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


    -- 3. Fix site_finance_tracker
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'site_finance_tracker' AND constraint_name = 'site_finance_tracker_created_by_fkey') THEN
        ALTER TABLE public.site_finance_tracker DROP CONSTRAINT site_finance_tracker_created_by_fkey;
    END IF;
    
    ALTER TABLE public.site_finance_tracker 
    ADD CONSTRAINT site_finance_tracker_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

END $$;
