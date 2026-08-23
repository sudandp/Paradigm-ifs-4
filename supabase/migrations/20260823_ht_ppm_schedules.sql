-- ============================================================================
-- Migration: Multi-Frequency PPM Schedules & Asset QR Tagging Engine
-- Date: 2026-08-23
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ht_ppm_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('RMU', 'DG_SET', 'TRANSFORMER', 'HT_PANEL', 'LT_KIOSK')),
  frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
  scheduled_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE')),
  assigned_engineer TEXT,
  completed_date TIMESTAMPTZ,
  completed_by TEXT,
  score NUMERIC(5,2),
  snags_count INT DEFAULT 0,
  item_responses JSONB DEFAULT '{}'::jsonb,
  overall_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ht_ppm_task_unique UNIQUE (asset_id, frequency, scheduled_date)
);

CREATE INDEX IF NOT EXISTS idx_ht_ppm_schedules_asset ON public.ht_ppm_schedules(asset_id);
CREATE INDEX IF NOT EXISTS idx_ht_ppm_schedules_freq ON public.ht_ppm_schedules(frequency);
CREATE INDEX IF NOT EXISTS idx_ht_ppm_schedules_date ON public.ht_ppm_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_ht_ppm_schedules_status ON public.ht_ppm_schedules(status);

-- Enable RLS
ALTER TABLE public.ht_ppm_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read ht_ppm_schedules" 
  ON public.ht_ppm_schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated write ht_ppm_schedules" 
  ON public.ht_ppm_schedules FOR ALL TO authenticated USING (true);

-- Allow public read for QR passport scanning without login
CREATE POLICY "Allow public read ht_ppm_schedules for QR passport" 
  ON public.ht_ppm_schedules FOR SELECT TO anon USING (true);
