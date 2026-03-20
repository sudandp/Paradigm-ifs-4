-- Site Costing Master table for Costing & Resource Configuration module
-- Uses JSONB config_data column (same pattern as site_configurations)

CREATE TABLE IF NOT EXISTS site_costing_master (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Draft',
  version_no INTEGER NOT NULL DEFAULT 1,
  config_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by site
CREATE INDEX IF NOT EXISTS idx_site_costing_master_site_id ON site_costing_master(site_id);

-- Enable Row Level Security
ALTER TABLE site_costing_master ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write (same pattern as other tables)
CREATE POLICY "Authenticated users can manage site costing" ON site_costing_master
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

