-- Migration: Create Site Finance Tracker Table
-- Description: Tracks financial data (contract amounts, fees, variations) per site/month.

CREATE TABLE IF NOT EXISTS public.site_finance_tracker (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    site_name TEXT NOT NULL,
    company_name TEXT,
    billing_month DATE NOT NULL, -- First day of the month being billed
    
    -- Financials
    contract_amount DECIMAL(12, 2) DEFAULT 0,
    management_fee DECIMAL(12, 2) DEFAULT 0,
    variation_amount DECIMAL(12, 2) DEFAULT 0,
    penalty_amount DECIMAL(12, 2) DEFAULT 0,
    total_billing_amount DECIMAL(12, 2) GENERATED ALWAYS AS (contract_amount + management_fee + variation_amount - penalty_amount) STORED,
    
    remarks TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, invoiced
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.site_finance_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to site_finance_tracker"
ON public.site_finance_tracker
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_finance_tracker;
