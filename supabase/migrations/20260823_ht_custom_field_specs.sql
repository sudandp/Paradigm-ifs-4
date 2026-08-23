-- ============================================================================
-- Migration: Dynamic Custom Field Specs for HT Yard Master Data & Site Audits
-- Date: 2026-08-23
-- ============================================================================

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ht_custom_field_unique UNIQUE (category, module_type, section_key, field_key)
);

CREATE INDEX IF NOT EXISTS idx_ht_custom_field_cat_mod ON public.ht_custom_field_specs(category, module_type);
CREATE INDEX IF NOT EXISTS idx_ht_custom_field_active ON public.ht_custom_field_specs(is_active);

-- Enable RLS
ALTER TABLE public.ht_custom_field_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read ht_custom_field_specs" 
  ON public.ht_custom_field_specs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write ht_custom_field_specs" 
  ON public.ht_custom_field_specs FOR ALL TO authenticated USING (true);
