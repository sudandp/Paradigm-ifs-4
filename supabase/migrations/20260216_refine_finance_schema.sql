-- Refine site_finance_tracker schema to match Excel structure

DO $$ 
BEGIN
    -- Rename management_fee to contract_management_fee if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'management_fee') THEN
        ALTER TABLE site_finance_tracker RENAME COLUMN management_fee TO contract_management_fee;
    END IF;

    -- Add new columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'billed_amount') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN billed_amount DECIMAL(12, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'billed_management_fee') THEN
        ALTER TABLE site_finance_tracker ADD COLUMN billed_management_fee DECIMAL(12, 2) DEFAULT 0;
    END IF;

    -- Drop columns that are no longer needed (variation, penalty)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'variation_amount') THEN
        ALTER TABLE site_finance_tracker DROP COLUMN variation_amount;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'penalty_amount') THEN
        ALTER TABLE site_finance_tracker DROP COLUMN penalty_amount;
    END IF;

    -- Update total_billing_amount generated column
    -- First drop the old one
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_finance_tracker' AND column_name = 'total_billing_amount') THEN
        ALTER TABLE site_finance_tracker DROP COLUMN total_billing_amount;
    END IF;

    -- Add new generated column for Total Billed (C + D)
    ALTER TABLE site_finance_tracker ADD COLUMN total_billed_amount DECIMAL(12, 2) GENERATED ALWAYS AS (billed_amount + billed_management_fee) STORED;

END $$;
