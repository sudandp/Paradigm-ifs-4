-- Migration to add billing_year to site_invoice_defaults
-- Description: Adds a billing_year INTEGER column to track annual contract changes.
-- Ensures that different years can have different contract details.

DO $$ 
BEGIN
    -- 1. Add billing_year column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'billing_year') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN billing_year INTEGER;
    END IF;

    -- 2. Add constraint to prevent duplicates for same site and year (if appropriate)
    -- But since we allow NULL (which would mean "default for all years"), we need to be careful.
    -- Assuming (site_id, billing_year) unique constraint only works if billing_year is not null?
    -- No, standard SQL unique allows multiple nulls.
    
    -- Let's add a unique constraint where billing_year IS NOT NULL
    -- CREATE UNIQUE INDEX site_invoice_defaults_year_unique ON site_invoice_defaults (site_id, billing_year) WHERE billing_year IS NOT NULL;
    
    -- Actually, let's keep it simple and handle uniqueness in code for now or just trust the inserts.
    -- But adding an index is good practice.
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'site_invoice_defaults' 
        AND indexname = 'idx_site_invoice_defaults_year_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_site_invoice_defaults_year_unique ON site_invoice_defaults (site_id, billing_year);
    END IF;

END $$;
