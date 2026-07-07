-- ============================================================================
-- Operations Module: Snag Audits Database Schema
-- Description: Table structure and RLS policies for tracking site snags
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.snag_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    email_address TEXT,
    name_of_site TEXT NOT NULL,
    purpose_of_visit TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    department TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
    snag_picture_url TEXT,
    snag_picture_name TEXT,
    criticality TEXT NOT NULL CHECK (criticality IN ('High', 'Medium', 'Low')),
    snag_description TEXT NOT NULL,
    action_to_be_taken TEXT NOT NULL,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
    submitted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_snag_audits_site ON public.snag_audits(name_of_site);
CREATE INDEX IF NOT EXISTS idx_snag_audits_status ON public.snag_audits(status);
CREATE INDEX IF NOT EXISTS idx_snag_audits_criticality ON public.snag_audits(criticality);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.snag_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snag_audits_select" ON public.snag_audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "snag_audits_insert" ON public.snag_audits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "snag_audits_update" ON public.snag_audits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "snag_audits_delete" ON public.snag_audits FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_snag_audits_updated_at') THEN
        CREATE TRIGGER trg_snag_audits_updated_at BEFORE UPDATE ON public.snag_audits
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
