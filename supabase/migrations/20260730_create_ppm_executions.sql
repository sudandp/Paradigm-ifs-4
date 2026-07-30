-- ============================================================================
-- Operations Module: PPM Executions Database Schema
-- Description: Table structure and RLS policies for PPM audit execution records
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ppm_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Default safety net only; client ALWAYS generates UUID
    site_name TEXT NOT NULL,
    reference_number TEXT NOT NULL,
    category_id TEXT NOT NULL,
    audit_date DATE NOT NULL,
    client_division TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWED')),
    auditor_name TEXT,
    organization_id UUID,
    observations JSONB NOT NULL DEFAULT '{}'::JSONB,
    summary_counts JSONB NOT NULL DEFAULT '{}'::JSONB,
    snag_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
    photo_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ppm_executions_site ON public.ppm_executions(site_name);
CREATE INDEX IF NOT EXISTS idx_ppm_executions_status ON public.ppm_executions(status);
CREATE INDEX IF NOT EXISTS idx_ppm_executions_category ON public.ppm_executions(category_id);
CREATE INDEX IF NOT EXISTS idx_ppm_executions_org ON public.ppm_executions(organization_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.ppm_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppm_executions_select" ON public.ppm_executions 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "ppm_executions_insert" ON public.ppm_executions 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ppm_executions_update" ON public.ppm_executions 
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "ppm_executions_delete" ON public.ppm_executions 
    FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ppm_executions_updated_at') THEN
        CREATE TRIGGER trg_ppm_executions_updated_at BEFORE UPDATE ON public.ppm_executions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
