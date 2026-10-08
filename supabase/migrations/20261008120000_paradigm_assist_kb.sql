-- Migration: 20261008120000_paradigm_assist_kb.sql
-- Description: Paradigm Assist AI Knowledge Base, Escalation, Staff Directory, Checklists, SOPs, Unanswered Queue, and Audit Schema

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Audit Logs Table (Reuse existing audit_logs table if present, ensuring all required columns exist)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id TEXT,
    diff JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.audit_logs 
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS table_name TEXT,
    ADD COLUMN IF NOT EXISTS record_id TEXT,
    ADD COLUMN IF NOT EXISTS diff JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_action ON public.audit_logs(table_name, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 3. Knowledge Modules Table (Generic extensible module registry)
CREATE TABLE IF NOT EXISTS public.knowledge_modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT DEFAULT 'BookOpen',
    is_active BOOLEAN DEFAULT true NOT NULL,
    display_order INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Knowledge Items Table (Central search index for FAQs, generic articles, and mirrored modules)
CREATE TABLE IF NOT EXISTS public.knowledge_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id UUID REFERENCES public.knowledge_modules(id) ON DELETE SET NULL,
    source_table TEXT,
    source_id UUID,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    rich_content TEXT,
    tags TEXT[] DEFAULT '{}'::text[],
    synonyms TEXT[] DEFAULT '{}'::text[],
    site_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    city TEXT,
    version INT DEFAULT 1 NOT NULL,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    embedding extensions.vector(1536),
    embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'ready', 'failed')),
    fts TSVECTOR,
    is_demo BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Trigger to calculate fts on insert/update
CREATE OR REPLACE FUNCTION public.update_knowledge_item_fts()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fts := setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
               setweight(to_tsvector('simple', coalesce(array_to_string(NEW.synonyms, ' '), '')), 'A') ||
               setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
               setweight(to_tsvector('english', coalesce(NEW.content, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_knowledge_item_fts') THEN
        CREATE TRIGGER trg_knowledge_item_fts
        BEFORE INSERT OR UPDATE ON public.knowledge_items
        FOR EACH ROW EXECUTE FUNCTION public.update_knowledge_item_fts();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_knowledge_items_module_id ON public.knowledge_items(module_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_site_id ON public.knowledge_items(site_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_city ON public.knowledge_items(city);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON public.knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_fts ON public.knowledge_items USING GIN(fts);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_tags ON public.knowledge_items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_synonyms ON public.knowledge_items USING GIN(synonyms);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_title_trgm ON public.knowledge_items USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_embedding ON public.knowledge_items USING hnsw (embedding extensions.vector_cosine_ops);

-- 5. Knowledge Item Versions Table (History and Rollback)
CREATE TABLE IF NOT EXISTS public.knowledge_item_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    version INT NOT NULL,
    snapshot JSONB NOT NULL,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kb_versions_item_id ON public.knowledge_item_versions(item_id, version DESC);

-- 6. Escalation Matrix Table
CREATE TABLE IF NOT EXISTS public.escalation_matrix (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    city TEXT NOT NULL,
    service_type TEXT NOT NULL, -- e.g. MEP, Security, Housekeeping, STP, General
    level TEXT NOT NULL CHECK (level IN ('L1', 'L2', 'L3', 'L4')),
    role_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    whatsapp TEXT,
    tat_minutes INT DEFAULT 60 NOT NULL,
    escalation_trigger TEXT NOT NULL,
    display_order INT DEFAULT 1 NOT NULL,
    is_demo BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_escalation_site_city ON public.escalation_matrix(site_id, city, service_type);

-- 7. Site Staff Directory Table
CREATE TABLE IF NOT EXISTS public.site_staff_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    employee_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    designation TEXT NOT NULL,
    department TEXT NOT NULL,
    phone TEXT NOT NULL,
    shift_type TEXT DEFAULT 'GS' CHECK (shift_type IN ('A', 'B', 'C', 'GS', 'HK-M', 'GAR', 'DAY-12', 'NIGHT-12', 'A+B', 'B+C', 'A+C')),
    reporting_manager_name TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_site_id ON public.site_staff_members(site_id);
CREATE INDEX IF NOT EXISTS idx_staff_designation ON public.site_staff_members(designation);

-- 8. SOP Documents Table
CREATE TABLE IF NOT EXISTS public.sop_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g. 'STP/WTP', 'MEP', 'Housekeeping', 'Security', 'DG', 'Pest Control', 'Safety'
    version TEXT DEFAULT 'v1.0' NOT NULL,
    effective_date DATE DEFAULT CURRENT_DATE NOT NULL,
    owner_name TEXT NOT NULL,
    steps JSONB DEFAULT '[]'::jsonb NOT NULL, -- Array of {step_number: int, title: text, description: text, critical: bool}
    attachment_urls TEXT[] DEFAULT '{}'::text[],
    site_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. Role Descriptions Table (JD, Daily/Weekly/Monthly tasks, KPIs)
CREATE TABLE IF NOT EXISTS public.role_descriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    designation TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    purpose TEXT NOT NULL,
    daily_tasks TEXT[] DEFAULT '{}'::text[],
    weekly_tasks TEXT[] DEFAULT '{}'::text[],
    monthly_tasks TEXT[] DEFAULT '{}'::text[],
    kpis TEXT[] DEFAULT '{}'::text[],
    escalation_boundaries TEXT,
    reporting_to TEXT,
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. Checklists Table (Must-Do Lists & Handover Logs)
CREATE TABLE IF NOT EXISTS public.checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'shift_handover')),
    target_role TEXT NOT NULL,
    service_type TEXT NOT NULL,
    items JSONB DEFAULT '[]'::jsonb NOT NULL, -- Array of {id: text, task: text, required: bool, category: text}
    site_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    is_demo BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 11. Assist Conversations Table
CREATE TABLE IF NOT EXISTS public.assist_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Conversation' NOT NULL,
    site_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assist_conv_user ON public.assist_conversations(user_id, updated_at DESC);

-- 12. Assist Messages Table
CREATE TABLE IF NOT EXISTS public.assist_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.assist_conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb, -- Array of {source_id, title, module, score}
    confidence NUMERIC(4,3),
    feedback_rating SMALLINT DEFAULT 0 CHECK (feedback_rating IN (-1, 0, 1)),
    latency_ms INT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assist_msg_conv ON public.assist_messages(conversation_id, created_at ASC);

-- 13. Unanswered Questions Table & Askers Table
CREATE TABLE IF NOT EXISTS public.unanswered_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question TEXT NOT NULL,
    normalized_question TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'rejected')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'critical')),
    asked_count INT DEFAULT 1 NOT NULL,
    site_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    source_message_id UUID REFERENCES public.assist_messages(id) ON DELETE SET NULL,
    closest_matches JSONB DEFAULT '[]'::jsonb,
    admin_answer TEXT,
    linked_item_id UUID REFERENCES public.knowledge_items(id) ON DELETE SET NULL,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_unanswered_status ON public.unanswered_questions(status, priority, asked_count DESC);
CREATE INDEX IF NOT EXISTS idx_unanswered_norm_q ON public.unanswered_questions(normalized_question);

CREATE TABLE IF NOT EXISTS public.unanswered_question_askers (
    question_id UUID NOT NULL REFERENCES public.unanswered_questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    asked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    notified_at TIMESTAMPTZ,
    PRIMARY KEY (question_id, user_id)
);

-- 14. Assist Settings Table (Singleton)
CREATE TABLE IF NOT EXISTS public.assist_settings (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    high_threshold NUMERIC(4,3) DEFAULT 0.78 NOT NULL,
    medium_threshold NUMERIC(4,3) DEFAULT 0.55 NOT NULL,
    emergency_contacts JSONB DEFAULT '[
        {"title": "Head Office 24x7 Helpdesk", "phone": "+91 80 4123 4567", "tat": "Instant"},
        {"title": "Director on Duty", "phone": "+91 98450 12345", "tat": "15 mins"},
        {"title": "Central Technical SME Escalation", "phone": "+91 98450 67890", "tat": "45-60 mins response"}
    ]'::jsonb NOT NULL,
    welcome_message TEXT DEFAULT 'Hello! I am Paradigm Assist, your operational knowledge companion. Ask me anything about SOPs, staff rosters, escalation contacts, or daily checklists.' NOT NULL,
    default_chips TEXT[] DEFAULT ARRAY[
        'Who is the FM at this site?',
        'Escalation contacts for MEP breakdown',
        'DG diesel refill and testing SOP',
        'STP daily parameters checklist',
        'Fire and emergency safety protocol'
    ],
    extra_instructions TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Ensure singleton row in assist_settings
INSERT INTO public.assist_settings (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 15. MIRRORING TRIGGERS (Auto-sync SOPs, Roles, Checklists into knowledge_items)
-- ============================================================================

-- A. SOP Document Sync Trigger
CREATE OR REPLACE FUNCTION public.sync_sop_to_knowledge_items()
RETURNS TRIGGER AS $$
DECLARE
    v_mod_id UUID;
    v_content TEXT;
BEGIN
    SELECT id INTO v_mod_id FROM public.knowledge_modules WHERE slug = 'sops' LIMIT 1;
    v_content := 'Category: ' || NEW.category || E'\nVersion: ' || NEW.version || E'\nOwner: ' || NEW.owner_name || E'\nSteps:\n' || 
                 (SELECT string_agg((elem->>'step_number') || '. ' || (elem->>'title') || ': ' || coalesce(elem->>'description', ''), E'\n') 
                  FROM jsonb_array_elements(NEW.steps) AS elem);

    IF (TG_OP = 'DELETE') THEN
        DELETE FROM public.knowledge_items WHERE source_table = 'sop_documents' AND source_id = OLD.id;
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE public.knowledge_items SET
            title = NEW.title,
            content = v_content,
            rich_content = jsonb_pretty(NEW.steps),
            site_id = NEW.site_id,
            status = NEW.status,
            tags = ARRAY[NEW.category, 'sop', 'procedure'],
            synonyms = ARRAY[NEW.category, 'how to operate', 'operating procedure'],
            embedding_status = 'pending',
            updated_at = now()
        WHERE source_table = 'sop_documents' AND source_id = NEW.id;
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.knowledge_items (
            module_id, source_table, source_id, title, content, rich_content, 
            site_id, status, tags, synonyms, is_demo, embedding_status
        ) VALUES (
            v_mod_id, 'sop_documents', NEW.id, NEW.title, v_content, jsonb_pretty(NEW.steps),
            NEW.site_id, NEW.status, ARRAY[NEW.category, 'sop', 'procedure'], ARRAY[NEW.category, 'how to operate'], NEW.is_demo, 'pending'
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_sop_kb ON public.sop_documents;
CREATE TRIGGER trg_sync_sop_kb
AFTER INSERT OR UPDATE OR DELETE ON public.sop_documents
FOR EACH ROW EXECUTE FUNCTION public.sync_sop_to_knowledge_items();

-- B. Role Description Sync Trigger
CREATE OR REPLACE FUNCTION public.sync_role_to_knowledge_items()
RETURNS TRIGGER AS $$
DECLARE
    v_mod_id UUID;
    v_content TEXT;
BEGIN
    SELECT id INTO v_mod_id FROM public.knowledge_modules WHERE slug = 'roles' LIMIT 1;
    v_content := 'Designation: ' || NEW.designation || E'\nDepartment: ' || NEW.department || E'\nPurpose: ' || NEW.purpose || 
                 E'\nDaily Tasks: ' || array_to_string(NEW.daily_tasks, ', ') || 
                 E'\nWeekly Tasks: ' || array_to_string(NEW.weekly_tasks, ', ') || 
                 E'\nKPIs: ' || array_to_string(NEW.kpis, ', ') || 
                 E'\nReporting To: ' || coalesce(NEW.reporting_to, 'Operations Manager');

    IF (TG_OP = 'DELETE') THEN
        DELETE FROM public.knowledge_items WHERE source_table = 'role_descriptions' AND source_id = OLD.id;
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE public.knowledge_items SET
            title = 'Role: ' || NEW.designation,
            content = v_content,
            tags = ARRAY[NEW.department, 'job description', 'responsibilities'],
            synonyms = ARRAY[NEW.designation, 'duties', 'kpis'],
            embedding_status = 'pending',
            updated_at = now()
        WHERE source_table = 'role_descriptions' AND source_id = NEW.id;
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.knowledge_items (
            module_id, source_table, source_id, title, content, 
            status, tags, synonyms, is_demo, embedding_status
        ) VALUES (
            v_mod_id, 'role_descriptions', NEW.id, 'Role: ' || NEW.designation, v_content,
            'published', ARRAY[NEW.department, 'job description', 'responsibilities'], ARRAY[NEW.designation, 'duties', 'kpis'], NEW.is_demo, 'pending'
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_role_kb ON public.role_descriptions;
CREATE TRIGGER trg_sync_role_kb
AFTER INSERT OR UPDATE OR DELETE ON public.role_descriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_knowledge_items();

-- C. Checklist Sync Trigger
CREATE OR REPLACE FUNCTION public.sync_checklist_to_knowledge_items()
RETURNS TRIGGER AS $$
DECLARE
    v_mod_id UUID;
    v_content TEXT;
BEGIN
    SELECT id INTO v_mod_id FROM public.knowledge_modules WHERE slug = 'checklists' LIMIT 1;
    v_content := 'Checklist: ' || NEW.title || E'\nFrequency: ' || NEW.frequency || E'\nRole: ' || NEW.target_role || 
                 E'\nItems:\n' || (SELECT string_agg((elem->>'task'), E'\n- ') FROM jsonb_array_elements(NEW.items) AS elem);

    IF (TG_OP = 'DELETE') THEN
        DELETE FROM public.knowledge_items WHERE source_table = 'checklists' AND source_id = OLD.id;
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        UPDATE public.knowledge_items SET
            title = NEW.title,
            content = v_content,
            rich_content = jsonb_pretty(NEW.items),
            site_id = NEW.site_id,
            status = NEW.status,
            tags = ARRAY[NEW.service_type, NEW.frequency, 'checklist', 'must-do'],
            synonyms = ARRAY[NEW.title, 'routine check', 'inspection'],
            embedding_status = 'pending',
            updated_at = now()
        WHERE source_table = 'checklists' AND source_id = NEW.id;
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.knowledge_items (
            module_id, source_table, source_id, title, content, rich_content, 
            site_id, status, tags, synonyms, is_demo, embedding_status
        ) VALUES (
            v_mod_id, 'checklists', NEW.id, NEW.title, v_content, jsonb_pretty(NEW.items),
            NEW.site_id, NEW.status, ARRAY[NEW.service_type, NEW.frequency, 'checklist', 'must-do'], ARRAY[NEW.title, 'routine check'], NEW.is_demo, 'pending'
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_checklist_kb ON public.checklists;
CREATE TRIGGER trg_sync_checklist_kb
AFTER INSERT OR UPDATE OR DELETE ON public.checklists
FOR EACH ROW EXECUTE FUNCTION public.sync_checklist_to_knowledge_items();

-- D. Versioning Trigger for Knowledge Items
CREATE OR REPLACE FUNCTION public.log_knowledge_item_version()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND (OLD.title <> NEW.title OR OLD.content <> NEW.content)) THEN
        NEW.version := OLD.version + 1;
        INSERT INTO public.knowledge_item_versions (item_id, version, snapshot, changed_by, changed_at)
        VALUES (
            OLD.id, 
            OLD.version, 
            jsonb_build_object('title', OLD.title, 'content', OLD.content, 'rich_content', OLD.rich_content, 'tags', OLD.tags, 'synonyms', OLD.synonyms),
            NEW.created_by,
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kb_versioning ON public.knowledge_items;
CREATE TRIGGER trg_kb_versioning
BEFORE UPDATE ON public.knowledge_items
FOR EACH ROW EXECUTE FUNCTION public.log_knowledge_item_version();

-- ============================================================================
-- 16. HYBRID RETRIEVAL POSTGRES RPC: search_knowledge_base
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_knowledge_base(
    query_text TEXT,
    query_embedding extensions.vector(1536) DEFAULT NULL,
    filter_site_id UUID DEFAULT NULL,
    filter_city TEXT DEFAULT NULL,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    module_id UUID,
    source_table TEXT,
    source_id UUID,
    title TEXT,
    content TEXT,
    rich_content TEXT,
    tags TEXT[],
    synonyms TEXT[],
    site_id UUID,
    city TEXT,
    version INT,
    status TEXT,
    cosine_similarity NUMERIC,
    fts_rank NUMERIC,
    trigram_similarity NUMERIC,
    composite_confidence NUMERIC
) AS $$
DECLARE
    cleaned_query TEXT;
BEGIN
    cleaned_query := trim(query_text);

    RETURN QUERY
    WITH scored AS (
        SELECT 
            ki.id,
            ki.module_id,
            ki.source_table,
            ki.source_id,
            ki.title,
            ki.content,
            ki.rich_content,
            ki.tags,
            ki.synonyms,
            ki.site_id,
            ki.city,
            ki.version,
            ki.status,
            -- A. Cosine Similarity (if embedding provided)
            CASE 
                WHEN query_embedding IS NOT NULL AND ki.embedding IS NOT NULL THEN
                    GREATEST(0.0, (1.0 - (ki.embedding <=> query_embedding)))::numeric
                ELSE 0.0::numeric
            END AS cos_score,
            -- B. Full-Text Search Rank
            ts_rank_cd(ki.fts, websearch_to_tsquery('english', cleaned_query))::numeric AS fts_score,
            -- C. Trigram Similarity on Title and Synonyms
            GREATEST(
                similarity(ki.title, cleaned_query),
                similarity(array_to_string(ki.synonyms, ' '), cleaned_query)
            )::numeric AS tri_score
        FROM public.knowledge_items ki
        WHERE ki.status = 'published'
          AND (filter_site_id IS NULL OR ki.site_id IS NULL OR ki.site_id = filter_site_id)
          AND (filter_city IS NULL OR ki.city IS NULL OR lower(ki.city) = lower(filter_city))
    )
    SELECT 
        s.id,
        s.module_id,
        s.source_table,
        s.source_id,
        s.title,
        s.content,
        s.rich_content,
        s.tags,
        s.synonyms,
        s.site_id,
        s.city,
        s.version,
        s.status,
        round(s.cos_score, 4) AS cosine_similarity,
        round(s.fts_score, 4) AS fts_rank,
        round(s.tri_score, 4) AS trigram_similarity,
        -- Exact/near-exact trigram match on FAQ/title overrides confidence to 1.0
        CASE 
            WHEN s.tri_score >= 0.90 THEN 1.0000
            ELSE round(
                (0.60 * s.cos_score) + 
                (0.25 * LEAST(1.0, s.fts_score * 2.0)) + 
                (0.15 * s.tri_score) +
                -- Boost site-specific match slightly if user has selected that site
                (CASE WHEN filter_site_id IS NOT NULL AND s.site_id = filter_site_id THEN 0.05 ELSE 0.0 END),
                4
            )
        END AS composite_confidence
    FROM scored s
    WHERE (s.cos_score > 0.35 OR s.fts_score > 0.02 OR s.tri_score > 0.25)
    ORDER BY composite_confidence DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 17. ROW LEVEL SECURITY (RLS) POLICIES & HELPER FUNCTIONS
-- ============================================================================

-- Helper: Check if current auth user has any of the given roles
CREATE OR REPLACE FUNCTION public.assist_has_role(allowed_roles TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role_id INTO v_role FROM public.users WHERE id = auth.uid();
    IF v_role IS NULL THEN
        RETURN false;
    END IF;
    RETURN (v_role = ANY(allowed_roles) OR v_role = 'admin' OR v_role = 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS across all Paradigm Assist tables
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_item_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unanswered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unanswered_question_askers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assist_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Knowledge Modules
DROP POLICY IF EXISTS "Allow read knowledge_modules for all authenticated" ON public.knowledge_modules;
CREATE POLICY "Allow read knowledge_modules for all authenticated" ON public.knowledge_modules
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write knowledge_modules" ON public.knowledge_modules;
CREATE POLICY "Allow admin write knowledge_modules" ON public.knowledge_modules
    FOR ALL TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin', 'management']));

-- Policies: Knowledge Items
DROP POLICY IF EXISTS "Allow read published knowledge_items for all authenticated" ON public.knowledge_items;
CREATE POLICY "Allow read published knowledge_items for all authenticated" ON public.knowledge_items
    FOR SELECT TO authenticated USING (
        status = 'published' OR public.assist_has_role(ARRAY['admin', 'super_admin', 'management', 'operation_manager'])
    );

DROP POLICY IF EXISTS "Allow admin write knowledge_items" ON public.knowledge_items;
CREATE POLICY "Allow admin write knowledge_items" ON public.knowledge_items
    FOR ALL TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin', 'management', 'operation_manager']));

-- Policies: Knowledge Item Versions
DROP POLICY IF EXISTS "Allow admin read versions" ON public.knowledge_item_versions;
CREATE POLICY "Allow admin read versions" ON public.knowledge_item_versions
    FOR SELECT TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin', 'management']));

-- Policies: Escalation Matrix
DROP POLICY IF EXISTS "Allow read escalation_matrix" ON public.escalation_matrix;
CREATE POLICY "Allow read escalation_matrix" ON public.escalation_matrix
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow manager write escalation_matrix" ON public.escalation_matrix;
CREATE POLICY "Allow manager write escalation_matrix" ON public.escalation_matrix
    FOR ALL TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin', 'management', 'operation_manager']));

-- Policies: Site Staff Members (Phone numbers gated)
DROP POLICY IF EXISTS "Allow read staff_members" ON public.site_staff_members;
CREATE POLICY "Allow read staff_members" ON public.site_staff_members
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow manager write staff_members" ON public.site_staff_members;
CREATE POLICY "Allow manager write staff_members" ON public.site_staff_members
    FOR ALL TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin', 'management', 'operation_manager', 'site_manager']));

-- Policies: SOPs
DROP POLICY IF EXISTS "Allow read published sops" ON public.sop_documents;
CREATE POLICY "Allow read published sops" ON public.sop_documents
    FOR SELECT TO authenticated USING (status = 'published' OR public.assist_has_role(ARRAY['admin', 'super_admin', 'management', 'operation_manager']));

DROP POLICY IF EXISTS "Allow admin write sops" ON public.sop_documents;
CREATE POLICY "Allow admin write sops" ON public.sop_documents
    FOR ALL TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin', 'management', 'operation_manager']));

-- Policies: Role Descriptions
DROP POLICY IF EXISTS "Allow read role_descriptions" ON public.role_descriptions;
CREATE POLICY "Allow read role_descriptions" ON public.role_descriptions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin write role_descriptions" ON public.role_descriptions;
CREATE POLICY "Allow admin write role_descriptions" ON public.role_descriptions
    FOR ALL TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin', 'management']));

-- Policies: Checklists
DROP POLICY IF EXISTS "Allow read published checklists" ON public.checklists;
CREATE POLICY "Allow read published checklists" ON public.checklists
    FOR SELECT TO authenticated USING (status = 'published' OR public.assist_has_role(ARRAY['admin', 'super_admin', 'management', 'operation_manager']));

DROP POLICY IF EXISTS "Allow manager write checklists" ON public.checklists;
CREATE POLICY "Allow manager write checklists" ON public.checklists
    FOR ALL TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin', 'management', 'operation_manager']));

-- Policies: Conversations & Messages (Owner can read/write own; Admin can read all with audit trail)
DROP POLICY IF EXISTS "Allow user manage own assist_conversations" ON public.assist_conversations;
CREATE POLICY "Allow user manage own assist_conversations" ON public.assist_conversations
    FOR ALL TO authenticated USING (user_id = auth.uid() OR public.assist_has_role(ARRAY['admin', 'super_admin']));

DROP POLICY IF EXISTS "Allow user manage own assist_messages" ON public.assist_messages;
CREATE POLICY "Allow user manage own assist_messages" ON public.assist_messages
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.assist_conversations c WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.assist_has_role(ARRAY['admin', 'super_admin'])))
    );

-- Policies: Unanswered Questions
DROP POLICY IF EXISTS "Allow read unanswered_questions" ON public.unanswered_questions;
CREATE POLICY "Allow read unanswered_questions" ON public.unanswered_questions
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow manager write unanswered_questions" ON public.unanswered_questions;
CREATE POLICY "Allow manager write unanswered_questions" ON public.unanswered_questions
    FOR ALL TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin', 'management', 'operation_manager']));

DROP POLICY IF EXISTS "Allow askers manage own askers rows" ON public.unanswered_question_askers;
CREATE POLICY "Allow askers manage own askers rows" ON public.unanswered_question_askers
    FOR ALL TO authenticated USING (user_id = auth.uid() OR public.assist_has_role(ARRAY['admin', 'super_admin']));

-- Policies: Assist Settings
DROP POLICY IF EXISTS "Allow all authenticated read assist_settings" ON public.assist_settings;
CREATE POLICY "Allow all authenticated read assist_settings" ON public.assist_settings
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow super_admin write assist_settings" ON public.assist_settings;
CREATE POLICY "Allow super_admin write assist_settings" ON public.assist_settings
    FOR ALL TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin']));

-- Policies: Audit Logs
DROP POLICY IF EXISTS "Allow read audit_logs for admins" ON public.audit_logs;
CREATE POLICY "Allow read audit_logs for admins" ON public.audit_logs
    FOR SELECT TO authenticated USING (public.assist_has_role(ARRAY['admin', 'super_admin']));

DROP POLICY IF EXISTS "Allow insert audit_logs" ON public.audit_logs;
CREATE POLICY "Allow insert audit_logs" ON public.audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- 18. DEMO SEED DATA (Fictional Records Marked is_demo = true)
-- ============================================================================

-- A. Default Knowledge Modules
INSERT INTO public.knowledge_modules (id, name, slug, description, icon, display_order)
VALUES 
    ('11111111-1111-1111-1111-111111111101', 'Escalation Matrix', 'escalation', 'Emergency and service escalation hierarchies with direct contact info', 'PhoneCall', 1),
    ('11111111-1111-1111-1111-111111111102', 'Site Staff Directory', 'staff', 'On-site technical, housekeeping, and security personnel rosters', 'Users', 2),
    ('11111111-1111-1111-1111-111111111103', 'Standard Operating Procedures', 'sops', 'Standard operating procedures and maintenance protocols', 'FileText', 3),
    ('11111111-1111-1111-1111-111111111104', 'Operational Checklists', 'checklists', 'Daily, weekly, and shift handover inspection checklists', 'CheckSquare', 4),
    ('11111111-1111-1111-1111-111111111105', 'Frequently Asked Questions', 'faqs', 'Common operational queries, policies, and guidelines', 'HelpCircle', 5),
    ('11111111-1111-1111-1111-111111111106', 'Roles & Responsibilities', 'roles', 'Job specifications, task schedules, and operational KPIs', 'Briefcase', 6),
    ('11111111-1111-1111-1111-111111111107', 'Bulletins & Circulars', 'bulletins', 'Safety advisories, training updates, and company announcements', 'Newspaper', 7)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- B. Demo Sites (Check if locations exist or insert demo placeholder locations)
DO $$
DECLARE
    v_blr_site1 UUID;
    v_blr_site2 UUID;
    v_hyd_site UUID;
    v_pune_site UUID;
BEGIN
    -- Select existing or insert demo locations
    SELECT id INTO v_blr_site1 FROM public.locations WHERE name ILIKE '%Adarsh Palm Retreat%' LIMIT 1;
    IF v_blr_site1 IS NULL THEN
        INSERT INTO public.locations (id, name, address, latitude, longitude, radius)
        VALUES ('22222222-2222-2222-2222-222222222201', 'Adarsh Palm Retreat', 'Outer Ring Road, Bellandur, Bengaluru', 12.9234, 77.6834, 100)
        ON CONFLICT (id) DO NOTHING;
        v_blr_site1 := '22222222-2222-2222-2222-222222222201';
    END IF;

    SELECT id INTO v_blr_site2 FROM public.locations WHERE name ILIKE '%Prestige Tech Park%' LIMIT 1;
    IF v_blr_site2 IS NULL THEN
        INSERT INTO public.locations (id, name, address, latitude, longitude, radius)
        VALUES ('22222222-2222-2222-2222-222222222202', 'Prestige Tech Park', 'Marathahalli - Sarjapur Outer Ring Rd, Bengaluru', 12.9372, 77.6912, 100)
        ON CONFLICT (id) DO NOTHING;
        v_blr_site2 := '22222222-2222-2222-2222-222222222202';
    END IF;

    SELECT id INTO v_hyd_site FROM public.locations WHERE name ILIKE '%Cyber Towers%' LIMIT 1;
    IF v_hyd_site IS NULL THEN
        INSERT INTO public.locations (id, name, address, latitude, longitude, radius)
        VALUES ('22222222-2222-2222-2222-222222222203', 'Cyber Towers HITEC City', 'HITEC City, Madhapur, Hyderabad', 17.4504, 78.3808, 100)
        ON CONFLICT (id) DO NOTHING;
        v_hyd_site := '22222222-2222-2222-2222-222222222203';
    END IF;

    SELECT id INTO v_pune_site FROM public.locations WHERE name ILIKE '%Magarpatta%' LIMIT 1;
    IF v_pune_site IS NULL THEN
        INSERT INTO public.locations (id, name, address, latitude, longitude, radius)
        VALUES ('22222222-2222-2222-2222-222222222204', 'Magarpatta City SEZ', 'Hadapsar, Pune', 18.5158, 73.9272, 100)
        ON CONFLICT (id) DO NOTHING;
        v_pune_site := '22222222-2222-2222-2222-222222222204';
    END IF;

    -- C. Demo Escalation Matrix Records
    IF NOT EXISTS (SELECT 1 FROM public.escalation_matrix WHERE is_demo = true) THEN
        INSERT INTO public.escalation_matrix (site_id, city, service_type, level, role_name, contact_person, phone, email, whatsapp, tat_minutes, escalation_trigger, display_order, is_demo)
        VALUES
            (v_blr_site1, 'Bengaluru', 'Technical MEP', 'L1', 'Site Facility Manager', 'Ramesh Kumar (Demo)', '+91 555-010-1001', 'fm.adarsh@paradigmfms.com', 'https://wa.me/915550101001', 30, 'Power trip or lift malfunction > 15 mins', 1, true),
            (v_blr_site1, 'Bengaluru', 'Technical MEP', 'L2', 'Operations Manager', 'Vikram Sethi (Demo)', '+91 555-010-1002', 'ops.blr1@paradigmfms.com', 'https://wa.me/915550101002', 45, 'Unresolved by L1 within 30 mins or major DG failure', 2, true),
            (v_blr_site1, 'Bengaluru', 'Technical MEP', 'L3', 'AVP Technical & Operations', 'Arun Swaminathan (Demo)', '+91 555-010-1003', 'avp.ops@paradigmfms.com', 'https://wa.me/915550101003', 60, 'Critical plant outage or transformer trip', 3, true),
            (v_blr_site1, 'Bengaluru', 'Technical MEP', 'L4', 'Director on Duty', 'Suresh Menon (Demo)', '+91 555-010-1004', 'director@paradigmfms.com', 'https://wa.me/915550101004', 15, 'Life safety, fire, or catastrophic disruption', 4, true),

            (v_hyd_site, 'Hyderabad', 'Security & Surveillance', 'L1', 'Security Supervisor', 'Mohd. Imran (Demo)', '+91 555-020-2001', 'sec.cybertowers@paradigmfms.com', 'https://wa.me/915550202001', 15, 'Unauthorized perimeter entry or gate bottleneck', 1, true),
            (v_hyd_site, 'Hyderabad', 'Security & Surveillance', 'L2', 'Operations Manager', 'Kalyan Rao (Demo)', '+91 555-020-2002', 'ops.hyd@paradigmfms.com', 'https://wa.me/915550202002', 30, 'Physical security breach or police report required', 2, true),
            (v_hyd_site, 'Hyderabad', 'Security & Surveillance', 'L3', 'Regional Head Hyderabad', 'Rajesh Varma (Demo)', '+91 555-020-2003', 'reg.hyd@paradigmfms.com', 'https://wa.me/915550202003', 45, 'Major theft or client legal notice', 3, true),
            (v_hyd_site, 'Hyderabad', 'Security & Surveillance', 'L4', 'Director', 'Suresh Menon (Demo)', '+91 555-010-1004', 'director@paradigmfms.com', 'https://wa.me/915550101004', 15, 'Severe crisis', 4, true),

            (v_pune_site, 'Pune', 'Water & STP Management', 'L1', 'STP Lead Technician', 'Nilesh Shinde (Demo)', '+91 555-030-3001', 'stp.magarpatta@paradigmfms.com', 'https://wa.me/915550303001', 30, 'Treated water smell, high BOD/COD or aeration blower trip', 1, true),
            (v_pune_site, 'Pune', 'Water & STP Management', 'L2', 'Operations Manager', 'Sachin Patil (Demo)', '+91 555-030-3002', 'ops.pune@paradigmfms.com', 'https://wa.me/915550303002', 45, 'Filter press breakdown or sludge overflow risk', 2, true),
            (v_pune_site, 'Pune', 'Water & STP Management', 'L3', 'Technical SME Water Division', 'Dr. Anand Joshi (Demo)', '+91 555-030-3003', 'sme.water@paradigmfms.com', 'https://wa.me/915550303003', 60, 'SME on-site dispatch within 45-60 mins', 3, true),
            (v_pune_site, 'Pune', 'Water & STP Management', 'L4', 'Director', 'Suresh Menon (Demo)', '+91 555-010-1004', 'director@paradigmfms.com', 'https://wa.me/915550101004', 15, 'Regulatory pollution control board escalation', 4, true);
    END IF;

    -- D. Demo Site Staff Directory
    IF NOT EXISTS (SELECT 1 FROM public.site_staff_members WHERE is_demo = true) THEN
        INSERT INTO public.site_staff_members (site_id, employee_id, full_name, designation, department, phone, shift_type, reporting_manager_name, is_demo)
        VALUES
            (v_blr_site1, 'PIFS-BLR-0101', 'Ramesh Kumar (Demo)', 'Facility Manager', 'Administration', '+91 555-010-1001', 'GS', 'Vikram Sethi', true),
            (v_blr_site1, 'PIFS-BLR-0102', 'Sunil Gowda (Demo)', 'Assistant Facility Manager', 'Administration', '+91 555-010-1005', 'GS', 'Ramesh Kumar', true),
            (v_blr_site1, 'PIFS-BLR-0103', 'Manjunath B (Demo)', 'Electrician / DG Operator', 'Technical MEP', '+91 555-010-1006', 'A', 'Sunil Gowda', true),
            (v_blr_site1, 'PIFS-BLR-0104', 'Basavaraj K (Demo)', 'Plumber / Pump Operator', 'Technical MEP', '+91 555-010-1007', 'B', 'Sunil Gowda', true),
            (v_blr_site1, 'PIFS-BLR-0105', 'Kavitha R (Demo)', 'Housekeeping Supervisor', 'Housekeeping', '+91 555-010-1008', 'HK-M', 'Ramesh Kumar', true),
            (v_blr_site1, 'PIFS-BLR-0106', 'Shankar Rao (Demo)', 'Security Guard (Day)', 'Security', '+91 555-010-1009', 'DAY-12', 'Ramesh Kumar', true),
            (v_blr_site1, 'PIFS-BLR-0107', 'Gopal Das (Demo)', 'Security Guard (Night)', 'Security', '+91 555-010-1010', 'NIGHT-12', 'Ramesh Kumar', true),

            (v_hyd_site, 'PIFS-HYD-0201', 'Anji Reddy (Demo)', 'Facility Manager', 'Administration', '+91 555-020-2005', 'GS', 'Kalyan Rao', true),
            (v_hyd_site, 'PIFS-HYD-0202', 'Mohd. Imran (Demo)', 'Security Supervisor', 'Security', '+91 555-020-2001', 'DAY-12', 'Anji Reddy', true),
            (v_hyd_site, 'PIFS-HYD-0203', 'Srinivasulu M (Demo)', 'Lead Electrician', 'Technical MEP', '+91 555-020-2006', 'A', 'Anji Reddy', true),

            (v_pune_site, 'PIFS-PUN-0301', 'Nilesh Shinde (Demo)', 'STP Plant Incharge', 'Water Management', '+91 555-030-3001', 'GS', 'Sachin Patil', true),
            (v_pune_site, 'PIFS-PUN-0302', 'Amol Kulkarni (Demo)', 'HVAC Technician', 'Technical MEP', '+91 555-030-3005', 'B', 'Nilesh Shinde', true);
    END IF;

    -- E. Demo SOPs
    IF NOT EXISTS (SELECT 1 FROM public.sop_documents WHERE is_demo = true) THEN
        INSERT INTO public.sop_documents (title, category, version, owner_name, steps, is_demo, site_id)
        VALUES
            (
                'STP Aeration and Parameter Monitoring SOP',
                'STP/WTP',
                'v2.1',
                'Water Engineering Team',
                '[
                    {"step_number": 1, "title": "Check MLSS & Aeration Tank DO", "description": "Verify Dissolved Oxygen is maintained between 2.0 to 3.5 mg/L using the handheld DO meter.", "critical": true},
                    {"step_number": 2, "title": "Inspect Aeration Blower Pressure", "description": "Ensure twin lobe blower oil level is normal, belt tension is firm, and discharge pressure is under 0.45 bar.", "critical": true},
                    {"step_number": 3, "title": "Check Sludge Return Ratio", "description": "Check RAS (Return Activated Sludge) pump running schedule; maintain 30-minute SV30 test around 250-350 mL/L.", "critical": false},
                    {"step_number": 4, "title": "Sodium Hypochlorite Dosing", "description": "Ensure chlorine dosing tank level is adequate to maintain 1-2 ppm residual chlorine in treated water tank.", "critical": true},
                    {"step_number": 5, "title": "Log Parameters in App", "description": "Enter DO, pH, turbidity, and cumulative energy consumption into the daily STP shift checklist.", "critical": false}
                ]'::jsonb,
                true,
                v_blr_site1
            ),
            (
                'Diesel Generator (DG) Synchronisation and Cold Start SOP',
                'MEP',
                'v1.8',
                'Central MEP Directorate',
                '[
                    {"step_number": 1, "title": "Verify Fuel Level & Battery Voltage", "description": "Check diesel day tank is at least 70% full and starter battery terminal voltage is >= 24.2V DC.", "critical": true},
                    {"step_number": 2, "title": "Check Engine Oil & Coolant Levels", "description": "Inspect dipstick between MIN and MAX marks. Ensure coolant expansion bottle is at level.", "critical": true},
                    {"step_number": 3, "title": "Switch to AUTO AMF Mode", "description": "Ensure Auto Mains Failure selector is set to AUTO so DG starts within 15 seconds of EB outage.", "critical": true},
                    {"step_number": 4, "title": "Check Frequency and Voltage Output", "description": "Verify steady 50.0 Hz +/- 0.5 Hz and 415V phase-to-phase output on DG synchroniser panel.", "critical": true},
                    {"step_number": 5, "title": "Safety Warning - Never Refuel While Hot", "description": "Never fill diesel while DG is running. Maintain 30-minute cooldown and keep 10kg ABC fire extinguisher unlatched nearby.", "critical": true}
                ]'::jsonb,
                true,
                NULL
            ),
            (
                'Passenger Lift Entrapment & Emergency Rescue SOP',
                'Safety',
                'v3.0',
                'Safety & Compliance Dept',
                '[
                    {"step_number": 1, "title": "Calm Passengers via Intercom", "description": "Immediately press lift intercom, reassure trapped passengers that ventilation is active and rescue is in progress.", "critical": true},
                    {"step_number": 2, "title": "Turn Off Main Lift 3-Phase Breaker", "description": "Go to lift machine room / controller room and switch OFF the main 3-phase circuit breaker for safety.", "critical": true},
                    {"step_number": 3, "title": "Locate Floor Level Indicator", "description": "Check yellow/red markings on hoist cables in machine room to determine closest landing zone.", "critical": true},
                    {"step_number": 4, "title": "Manual Brake Release Protocol", "description": "Qualified technician only: Carefully fit manual brake lever and hand-wind wheel until floor indicator aligns with landing sill.", "critical": true},
                    {"step_number": 5, "title": "Door Key Release and Passenger Evacuation", "description": "Use triangular drop key on landing door. Open gently, assist passengers out, keep lift parked and locked OUT OF ORDER until OEM arrives.", "critical": true}
                ]'::jsonb,
                true,
                NULL
            );
    END IF;

    -- F. Demo Role Descriptions
    IF NOT EXISTS (SELECT 1 FROM public.role_descriptions WHERE designation = 'Facility Manager') THEN
        INSERT INTO public.role_descriptions (designation, department, purpose, daily_tasks, weekly_tasks, monthly_tasks, kpis, escalation_boundaries, reporting_to, is_demo)
        VALUES
            (
                'Facility Manager',
                'Operations & Administration',
                'Single-point operational leader accountable for client satisfaction, staff discipline, asset uptime, SLA compliance, and regulatory adherence at the designated property.',
                ARRAY[
                    'Conduct 08:30 AM morning site round covering gate, STP, DG room, lobby, and basement.',
                    'Review biometric attendance logs and shift relievers; arrange double-duty relievers if vacancy exceeds 1.',
                    'Coordinate daily client meetings / builder engineering team interactions.',
                    'Inspect helpdesk tickets and ensure 100% resolution within agreed SLA turnaround time.'
                ],
                ARRAY[
                    'Review DG run hours, diesel consumption against billing meter logs.',
                    'Inspect water meter readings (borewell, tanker, municipal supply, STP recycled).',
                    'Conduct pest control and garden trimming audit with IPM supervisor.'
                ],
                ARRAY[
                    'Submit Monthly Operational Review (MOR) report to client board with uptime charts.',
                    'Audit statutory compliance: Form 6, minimum wages register, ESI/PF challan display.',
                    'Review staff uniform replacements, safety shoes, and PPE condition.'
                ],
                ARRAY['Client CSAT >= 90%', 'Ticket SLA Closure >= 98%', 'Zero Major Statutory Non-Compliance', 'Asset Uptime >= 99.5%'],
                'Financial approvals above Rs. 10,000, police complaints, major equipment breakdown, and union disputes must be escalated to Operations Manager and Director immediately.',
                'Operations Manager',
                true
            ),
            (
                'Electrician / DG Operator',
                'Technical MEP',
                'Hands-on technical specialist ensuring continuous electrical supply, DG availability, transformer health, and prompt resolution of resident/tenant electrical tickets.',
                ARRAY[
                    'Perform 07:00 AM shift inspection of LT panels, capacitor banks, and power factor (maintain > 0.98).',
                    'Check DG battery electrolyte gravity and diesel day tank levels.',
                    'Attend resident helpdesk tickets within 15 minutes of allocation.',
                    'Check basement and staircase emergency lighting circuits.'
                ],
                ARRAY[
                    'Test DG on no-load / partial load for 10 minutes every Tuesday.',
                    'Clean electrical panel ventilation filters and check infrared thermal hotspots.',
                    'Check earth pit resistance testing and log in MEP register.'
                ],
                ARRAY[
                    'Assist in transformer oil breakdown voltage (BDV) sampling.',
                    'Comprehensive ACB and VCB servicing with authorized OEM team.'
                ],
                ARRAY['DG Auto-Start Success Rate: 100%', 'Power Factor Penalty: Nil', 'Average Ticket Resolution Time: < 30 mins'],
                'Any HT yard switching, transformer tripping, or fire alarm activation must be escalated to Assistant FM and FM within 5 minutes.',
                'Assistant Facility Manager / Facility Manager',
                true
            );
    END IF;

    -- G. Demo Checklists
    IF NOT EXISTS (SELECT 1 FROM public.checklists WHERE is_demo = true) THEN
        INSERT INTO public.checklists (title, frequency, target_role, service_type, items, is_demo, site_id)
        VALUES
            (
                'FM Daily Morning Site Round Checklist',
                'daily',
                'Facility Manager',
                'General Operations',
                '[
                    {"id": "chk-1", "task": "Check Main Gate Guard turnout, neat uniforms, and visitor kiosk log", "required": true, "category": "Security"},
                    {"id": "chk-2", "task": "Verify DG AMF panel selector is in AUTO mode with >= 70% fuel", "required": true, "category": "MEP"},
                    {"id": "chk-3", "task": "Inspect STP aeration tank dissolved oxygen and clarity of final treated water", "required": true, "category": "Water"},
                    {"id": "chk-4", "task": "Check clubhouse, common restrooms, and lifts cleanliness / odour free", "required": true, "category": "Housekeeping"},
                    {"id": "chk-5", "task": "Review night shift incident log and open tickets with Assistant FM", "required": true, "category": "Administration"}
                ]'::jsonb,
                true,
                v_blr_site1
            ),
            (
                'Security Shift Handover & Kiosk Inspection Checklist',
                'shift_handover',
                'Security Supervisor',
                'Security',
                '[
                    {"id": "sec-1", "task": "Physical count of issued walkie-talkies, torches, and boom barrier remotes", "required": true, "category": "Assets"},
                    {"id": "sec-2", "task": "Verify all CCTV cameras active on surveillance console (report blank channels)", "required": true, "category": "Surveillance"},
                    {"id": "sec-3", "task": "Inspect gate visitor app kiosk tablet battery status and internet connectivity", "required": true, "category": "Gate Kiosk"},
                    {"id": "sec-4", "task": "Verify overnight parked vehicle inventory and delivery vehicle exit logs", "required": true, "category": "Parking"},
                    {"id": "sec-5", "task": "Confirm reliever guards are present and turn out inspection complete", "required": true, "category": "Manpower"}
                ]'::jsonb,
                true,
                NULL
            );
    END IF;

    -- H. Demo FAQs in Knowledge Items
    IF NOT EXISTS (SELECT 1 FROM public.knowledge_items WHERE is_demo = true) THEN
        INSERT INTO public.knowledge_items (title, content, tags, synonyms, status, is_demo, site_id, city)
        VALUES
            (
                'What are Paradigm standard shift timings and duty hours?',
                'Paradigm IFS operates on standardized shift windows: Shift A (Morning) 07:00 to 15:00 (arrival window 05:00 - 11:30); Shift B (Afternoon) 14:00 to 22:00 (arrival window 11:30 - 18:30); Shift C (Night) 21:00/22:00 to 06:00/07:00 next day (arrival window 18:30 - 23:59, credited to Day 1); General Shift (GS) 09:00 to 18:00 (min 8 hours); Security 12-hour shifts: DAY-12 (07:00 to 19:00) and NIGHT-12 (19:00 to 07:00 next day). Double duty (A+B, B+C, A+C) strictly requires at least 14 hours across two shift brackets and earns 2.0x duty multiplier.',
                ARRAY['attendance', 'shifts', 'shift timings', 'double duty', 'hours'],
                ARRAY['shift timings', 'duty time', 'morning shift', 'night shift', 'general shift', 'double duty rules', 'hours of duty'],
                'published',
                true,
                NULL,
                'Bengaluru'
            ),
            (
                'How is weekly off calculated for site staff?',
                'Every active employee who completes 6 working duties earns 1 paid Weekly Off (W/O). Under Paradigm attendance policy, weekly off is strictly capped at a MAXIMUM of 1 Weekly Off per calendar week (Monday to Sunday). If an employee works on their rostered off day, the status is recorded as W/P (Weekly Off Present). Any second unworked day in the same calendar week is marked Absent (A).',
                ARRAY['attendance', 'weekly off', 'wo', 'policy', 'leave'],
                ARRAY['weekly off rule', 'chutti', 'week off', '6 day duty cycle', 'wo policy'],
                'published',
                true,
                NULL,
                NULL
            ),
            (
                'What is the emergency escalation procedure during a fire or gas leak?',
                'SAFETY PROTOCOL: 1. Immediately sound the manual call point (MCP) fire alarm. 2. Evacuate people through staircases — NEVER use lifts. 3. Call Fire Services (101) and Paradigm Head Office 24x7 Helpdesk (+91 80 4123 4567). 4. If gas leak: turn off main PNG/LPG manifold valve, open all doors/windows, do NOT operate electrical switches. 5. Notify Director on Duty (+91 98450 12345) and on-site SME team will respond within 45-60 minutes.',
                ARRAY['emergency', 'fire', 'gas leak', 'safety', 'life safety', 'escalation'],
                ARRAY['aag lag gaya', 'fire incident', 'gas smell', 'lpg leak', 'emergency call', 'evacuation'],
                'published',
                true,
                NULL,
                NULL
            ),
            (
                'Who is responsible for DG diesel refilling and fuel quality checks?',
                'The site Electrician / DG Operator and Assistant Facility Manager are responsible for diesel monitoring. The fuel day tank must never drop below 70% capacity. When diesel tankers arrive, the FM must verify: (a) Delivery challan, (b) Density hydrometer test (density should be 820-860 kg/m3 at 15C), (c) Water bottom paste dip test. Both the invoice and meter reading must be uploaded to the app immediately.',
                ARRAY['dg', 'diesel', 'fuel', 'mep', 'generator'],
                ARRAY['dg fuel refill', 'diesel refill procedure', 'generator diesel check', 'diesel quality'],
                'published',
                true,
                NULL,
                NULL
            );
    END IF;

END $$;
