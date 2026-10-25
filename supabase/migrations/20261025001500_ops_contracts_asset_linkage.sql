-- ============================================================================
-- Phase 4: Enterprise Contract & AMC Management with Asset Linkage
-- Paradigm Office 4 Facility OS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ops_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT,
    entity_id TEXT REFERENCES public.entities(id) ON DELETE SET NULL,
    contract_title TEXT NOT NULL,
    contract_type TEXT NOT NULL DEFAULT 'Vendor AMC',
    vendor_name TEXT,
    vendor_contact_person TEXT,
    vendor_phone TEXT,
    vendor_email TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    contract_value NUMERIC DEFAULT 0,
    payment_frequency TEXT DEFAULT 'Quarterly',
    status TEXT DEFAULT 'Active',
    renewal_reminder_days INTEGER DEFAULT 30,
    scope_of_work TEXT,
    sla_response_time_hours INT DEFAULT 4,
    sla_resolution_time_hours INT DEFAULT 24,
    covered_asset_ids TEXT[] DEFAULT '{}',
    document_url TEXT,
    notes TEXT,
    auto_renewal BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ops_contracts
    ADD COLUMN IF NOT EXISTS vendor_contact_person TEXT,
    ADD COLUMN IF NOT EXISTS vendor_phone TEXT,
    ADD COLUMN IF NOT EXISTS vendor_email TEXT,
    ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'Quarterly',
    ADD COLUMN IF NOT EXISTS scope_of_work TEXT,
    ADD COLUMN IF NOT EXISTS sla_response_time_hours INT DEFAULT 4,
    ADD COLUMN IF NOT EXISTS sla_resolution_time_hours INT DEFAULT 24,
    ADD COLUMN IF NOT EXISTS covered_asset_ids TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ops_contracts_entity ON public.ops_contracts(entity_id);
CREATE INDEX IF NOT EXISTS idx_ops_contracts_end_date ON public.ops_contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_ops_contracts_status ON public.ops_contracts(status);

ALTER TABLE public.ops_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ops_contracts' AND policyname = 'ops_contracts_all'
    ) THEN
        CREATE POLICY ops_contracts_all ON public.ops_contracts FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
