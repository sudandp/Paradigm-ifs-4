-- Template Change Logs table
-- Stores upload/download activity for the Templates Hub module

CREATE TABLE IF NOT EXISTS template_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upload', 'download')),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL DEFAULT 'Unknown',
  rows_affected INTEGER NOT NULL DEFAULT 0,
  rows_created INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by template and date
CREATE INDEX IF NOT EXISTS idx_template_change_logs_template ON template_change_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_template_change_logs_created ON template_change_logs(created_at DESC);

-- RLS Policies
ALTER TABLE template_change_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert logs
CREATE POLICY "Allow authenticated insert" ON template_change_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read all logs
CREATE POLICY "Allow authenticated read" ON template_change_logs
  FOR SELECT TO authenticated
  USING (true);
