-- Migration: Add revision tracking to tracker tables
-- Description: Creates revision history tables and adds revision_count to main tables.

-- 1. Add revision_count to main tables
ALTER TABLE public.site_invoice_tracker 
ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;

ALTER TABLE public.site_finance_tracker 
ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;

-- 2. Create site_invoice_revisions table
CREATE TABLE IF NOT EXISTS public.site_invoice_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.site_invoice_tracker(id) ON DELETE CASCADE,
    revised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    revised_by_name TEXT,
    revised_at TIMESTAMPTZ DEFAULT NOW(),
    diff JSONB NOT NULL, -- Stores { field: { old: val, new: val } }
    revision_number INTEGER NOT NULL
);

-- 3. Create site_finance_revisions table
CREATE TABLE IF NOT EXISTS public.site_finance_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL REFERENCES public.site_finance_tracker(id) ON DELETE CASCADE,
    revised_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    revised_by_name TEXT,
    revised_at TIMESTAMPTZ DEFAULT NOW(),
    diff JSONB NOT NULL,
    revision_number INTEGER NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.site_invoice_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_finance_revisions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Basic access for authenticated users)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.site_invoice_revisions;
CREATE POLICY "Enable read access for all users" ON public.site_invoice_revisions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON public.site_invoice_revisions;
CREATE POLICY "Enable insert for all users" ON public.site_invoice_revisions
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON public.site_finance_revisions;
CREATE POLICY "Enable read access for all users" ON public.site_finance_revisions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for all users" ON public.site_finance_revisions;
CREATE POLICY "Enable insert for all users" ON public.site_finance_revisions
    FOR INSERT TO authenticated WITH CHECK (true);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_site_invoice_revisions_record_id ON public.site_invoice_revisions(record_id);
CREATE INDEX IF NOT EXISTS idx_site_finance_revisions_record_id ON public.site_finance_revisions(record_id);
