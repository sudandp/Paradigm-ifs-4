-- ============================================================================
-- Migration: Complete HT Yard Audit, Master Options & Sub-Questions Schema
-- Date: 2026-08-28
-- Description: Ensures ht_yard_audits, ht_master_options, and ht_custom_field_specs
--              support sub-questions (parent_field_key), feeder counts, custom titles,
--              duplicated stages, and audit change logs.
-- ============================================================================

-- 1. Main HT Yard Audits Table (Primary audit document store used by API)
CREATE TABLE IF NOT EXISTS public.ht_yard_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name TEXT NOT NULL,
  reference_number TEXT,
  audit_date DATE DEFAULT CURRENT_DATE,
  client_division TEXT,
  status TEXT DEFAULT 'Draft',
  auditor_name TEXT,
  equipment_instances JSONB DEFAULT '[]'::jsonb,
  responses JSONB DEFAULT '{}'::jsonb,
  snag_items JSONB DEFAULT '[]'::jsonb,
  duplicated_stages JSONB DEFAULT '{}'::jsonb,
  audit_logs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all columns exist on ht_yard_audits if table was created previously
ALTER TABLE public.ht_yard_audits 
  ADD COLUMN IF NOT EXISTS duplicated_stages JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audit_logs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS equipment_instances JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS responses JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS snag_items JSONB DEFAULT '[]'::jsonb;

-- Indexes for ht_yard_audits
CREATE INDEX IF NOT EXISTS idx_ht_yard_audits_site_name ON public.ht_yard_audits(site_name);
CREATE INDEX IF NOT EXISTS idx_ht_yard_audits_status ON public.ht_yard_audits(status);
CREATE INDEX IF NOT EXISTS idx_ht_yard_audits_updated_at ON public.ht_yard_audits(updated_at DESC);

-- Enable RLS for ht_yard_audits
ALTER TABLE public.ht_yard_audits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ht_yard_audits' AND policyname = 'Allow authenticated read ht_yard_audits') THEN
    CREATE POLICY "Allow authenticated read ht_yard_audits" ON public.ht_yard_audits FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ht_yard_audits' AND policyname = 'Allow authenticated write ht_yard_audits') THEN
    CREATE POLICY "Allow authenticated write ht_yard_audits" ON public.ht_yard_audits FOR ALL TO authenticated USING (true);
  END IF;
END $$;


-- 2. Master Data Options Table (Dropdown choices & Cascade relationships)
CREATE TABLE IF NOT EXISTS public.ht_master_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  manufacturer TEXT,
  field_key TEXT NOT NULL,
  parent_field_key TEXT,
  option_value TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add parent_field_key column if missing
ALTER TABLE public.ht_master_options 
  ADD COLUMN IF NOT EXISTS parent_field_key TEXT;

-- Indexes for ht_master_options
CREATE INDEX IF NOT EXISTS idx_ht_master_options_cat_field ON public.ht_master_options(category, field_key);
CREATE INDEX IF NOT EXISTS idx_ht_master_options_parent ON public.ht_master_options(parent_field_key);

-- Enable RLS for ht_master_options
ALTER TABLE public.ht_master_options ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ht_master_options' AND policyname = 'Allow authenticated read ht_master_options') THEN
    CREATE POLICY "Allow authenticated read ht_master_options" ON public.ht_master_options FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ht_master_options' AND policyname = 'Allow authenticated write ht_master_options') THEN
    CREATE POLICY "Allow authenticated write ht_master_options" ON public.ht_master_options FOR ALL TO authenticated USING (true);
  END IF;
END $$;


-- 3. Dynamic Custom Field Specs & Follow-up Questions Table
CREATE TABLE IF NOT EXISTS public.ht_custom_field_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  module_type TEXT NOT NULL,
  section_key TEXT NOT NULL,
  section_title TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  options_category TEXT,
  options_field_key TEXT,
  is_manufacturer_field BOOLEAN DEFAULT FALSE,
  unit TEXT,
  placeholder TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_custom BOOLEAN DEFAULT TRUE,
  parent_field_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ht_custom_field_unique UNIQUE (category, module_type, section_key, field_key)
);

-- Add parent_field_key column if missing
ALTER TABLE public.ht_custom_field_specs 
  ADD COLUMN IF NOT EXISTS parent_field_key TEXT;

-- Indexes for ht_custom_field_specs
CREATE INDEX IF NOT EXISTS idx_ht_custom_field_cat_mod ON public.ht_custom_field_specs(category, module_type);
CREATE INDEX IF NOT EXISTS idx_ht_custom_field_parent ON public.ht_custom_field_specs(parent_field_key);

-- Enable RLS for ht_custom_field_specs
ALTER TABLE public.ht_custom_field_specs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ht_custom_field_specs' AND policyname = 'Allow authenticated read ht_custom_field_specs') THEN
    CREATE POLICY "Allow authenticated read ht_custom_field_specs" ON public.ht_custom_field_specs FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ht_custom_field_specs' AND policyname = 'Allow authenticated write ht_custom_field_specs') THEN
    CREATE POLICY "Allow authenticated write ht_custom_field_specs" ON public.ht_custom_field_specs FOR ALL TO authenticated USING (true);
  END IF;
END $$;
