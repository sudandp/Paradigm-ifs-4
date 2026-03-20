-- Migration: Create Site Invoice Defaults Table
-- Description: Stores per-site default values for auto-fill in invoice tracker.

CREATE TABLE IF NOT EXISTS public.site_invoice_defaults (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id TEXT NOT NULL UNIQUE,
    site_name TEXT NOT NULL,
    company_name TEXT,
    billing_cycle TEXT,
    ops_incharge TEXT,
    hr_incharge TEXT,
    invoice_incharge TEXT,
    manager_tentative_date DATE,
    hr_tentative_date DATE,
    invoice_sharing_tentative_date DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.site_invoice_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to site_invoice_defaults"
ON public.site_invoice_defaults
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
