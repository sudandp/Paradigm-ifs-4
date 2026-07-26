-- ============================================================================
-- Migration: HT Yard / Site Take-Over Electrical Audit Module
-- Date: 2026-07-26
-- ============================================================================

-- 1. HT Audits Table (Header for Site-level Audits)
CREATE TABLE IF NOT EXISTS public.ht_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT REFERENCES public.organizations(id) ON DELETE SET NULL,
  site_id TEXT,
  site_name TEXT NOT NULL,
  location_address TEXT,
  gps_coordinates JSONB DEFAULT '{}'::jsonb, -- { lat: number, lng: number }
  client_division TEXT,
  reference_number TEXT NOT NULL UNIQUE,
  audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  auditor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  auditor_name TEXT,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Under_Review', 'Approved', 'Sent_Back')),
  hira_checklist JSONB DEFAULT '[]'::jsonb, -- 12-point HIRA assessment array
  ht_yard_common_points JSONB DEFAULT '{}'::jsonb, -- Yard fencing, safety docs, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Equipment Instances Table (Repeatable equipment units per site)
CREATE TABLE IF NOT EXISTS public.ht_equipment_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.ht_audits(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL CHECK (module_type IN ('RMU', 'Switchgear', 'HT_Panel', 'Meter_Cubicle', 'VCB', 'Transformer', 'CSS', 'LT_Kiosk')),
  instance_name TEXT NOT NULL, -- e.g. "RMU 1", "Transformer 2"
  instance_number INT NOT NULL DEFAULT 1,
  feeder_way_count INT NOT NULL DEFAULT 4,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Audit Item Responses Table (Field level checklist inputs)
CREATE TABLE IF NOT EXISTS public.ht_audit_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.ht_audits(id) ON DELETE CASCADE,
  equipment_instance_id UUID REFERENCES public.ht_equipment_instances(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL,
  section_key TEXT NOT NULL,
  item_number INT NOT NULL,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  response_value TEXT,
  remarks TEXT,
  photo_urls TEXT[] DEFAULT '{}'::text[],
  is_not_applicable BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ht_audit_responses_unique_item UNIQUE (audit_id, equipment_instance_id, section_key, field_key)
);

-- 4. HT Snag Points Table (Punch-list items attached to equipment or site)
CREATE TABLE IF NOT EXISTS public.ht_snag_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES public.ht_audits(id) ON DELETE CASCADE,
  equipment_instance_id UUID REFERENCES public.ht_equipment_instances(id) ON DELETE CASCADE,
  item_number INT DEFAULT 1,
  snag_point TEXT NOT NULL,
  action_suggested TEXT NOT NULL,
  photo_url TEXT,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  target_date DATE,
  completed_date DATE,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In_Progress', 'Closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. HT Master Options Table (Master reference options for cascading dropdowns)
CREATE TABLE IF NOT EXISTS public.ht_master_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('Cable Details', 'RMUMD', 'TRMaster Data', 'LTKMD')),
  manufacturer TEXT, -- Null for general options like Cable Details
  field_key TEXT NOT NULL,
  option_value TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index creation for performance
CREATE INDEX IF NOT EXISTS idx_ht_audits_site_id ON public.ht_audits(site_id);
CREATE INDEX IF NOT EXISTS idx_ht_audits_status ON public.ht_audits(status);
CREATE INDEX IF NOT EXISTS idx_ht_equipment_instances_audit_id ON public.ht_equipment_instances(audit_id);
CREATE INDEX IF NOT EXISTS idx_ht_audit_responses_audit_inst ON public.ht_audit_responses(audit_id, equipment_instance_id);
CREATE INDEX IF NOT EXISTS idx_ht_snag_items_audit_id ON public.ht_snag_items(audit_id);
CREATE INDEX IF NOT EXISTS idx_ht_master_options_cat_mfr ON public.ht_master_options(category, manufacturer);

-- Row Level Security (RLS) Policies
ALTER TABLE public.ht_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ht_equipment_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ht_audit_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ht_snag_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ht_master_options ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and manage HT audits
CREATE POLICY "Allow authenticated read ht_audits" ON public.ht_audits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert ht_audits" ON public.ht_audits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update ht_audits" ON public.ht_audits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete ht_audits" ON public.ht_audits FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read ht_equipment_instances" ON public.ht_equipment_instances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert ht_equipment_instances" ON public.ht_equipment_instances FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update ht_equipment_instances" ON public.ht_equipment_instances FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete ht_equipment_instances" ON public.ht_equipment_instances FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read ht_audit_responses" ON public.ht_audit_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert ht_audit_responses" ON public.ht_audit_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update ht_audit_responses" ON public.ht_audit_responses FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read ht_snag_items" ON public.ht_snag_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert ht_snag_items" ON public.ht_snag_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update ht_snag_items" ON public.ht_snag_items FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated read ht_master_options" ON public.ht_master_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write ht_master_options" ON public.ht_master_options FOR ALL TO authenticated USING (true);

-- 6. Supabase Storage Bucket Setup for HT Yard Photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('ht-yard-photos', 'ht-yard-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Public Read Access for ht-yard-photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'ht-yard-photos');

CREATE POLICY "Authenticated Upload Access for ht-yard-photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ht-yard-photos');

CREATE POLICY "Authenticated Update/Delete for ht-yard-photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ht-yard-photos');

