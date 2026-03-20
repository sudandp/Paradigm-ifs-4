-- Migration: Add missing contract columns to site_invoice_defaults
-- Description: Adds contract_amount and contract_management_fee to defaults table.

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'contract_amount') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN contract_amount DECIMAL(12, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'contract_management_fee') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN contract_management_fee DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;
