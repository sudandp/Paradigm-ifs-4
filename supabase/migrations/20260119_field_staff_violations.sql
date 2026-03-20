-- Field Staff Site/Travel Violations System
-- Migration: 20260119_field_staff_violations.sql

-- Helper function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create violations table
CREATE TABLE IF NOT EXISTS field_attendance_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  date DATE NOT NULL,
  
  -- Time breakdown
  total_hours DECIMAL(5,2) NOT NULL,
  site_hours DECIMAL(5,2) NOT NULL,
  travel_hours DECIMAL(5,2) NOT NULL,
  site_percentage DECIMAL(5,2) NOT NULL,
  travel_percentage DECIMAL(5,2) NOT NULL,
  
  -- Violation details
  violation_type TEXT NOT NULL, -- 'site_time_low', 'insufficient_hours'
  required_site_percentage DECIMAL(5,2) NOT NULL, -- The min% that was required
  
  -- Workflow status
  status TEXT DEFAULT 'pending', -- 'pending', 'acknowledged', 'escalated'
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  manager_notes TEXT,
  
  -- Escalation tracking
  escalated_to UUID REFERENCES users(id),
  escalated_at TIMESTAMPTZ,
  escalation_level INTEGER DEFAULT 0, -- 0=direct manager, 1=HR/Admin
  
  -- Impacts
  affects_salary BOOLEAN DEFAULT true,
  affects_performance BOOLEAN DEFAULT true,
  attendance_granted BOOLEAN DEFAULT false, -- True after acknowledgment
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_violations_user_date ON field_attendance_violations(user_id, date DESC);
CREATE INDEX idx_violations_status ON field_attendance_violations(status);
CREATE INDEX idx_violations_escalated ON field_attendance_violations(escalated_to) WHERE status = 'escalated';
CREATE INDEX idx_violations_pending ON field_attendance_violations(status, created_at) WHERE status = 'pending';

-- RLS Policies
ALTER TABLE field_attendance_violations ENABLE ROW LEVEL SECURITY;

-- Users can view their own violations
CREATE POLICY "Users can view own violations"
  ON field_attendance_violations FOR SELECT
  USING (auth.uid() = user_id);

-- Managers can view their team's violations
CREATE POLICY "Managers can view team violations"
  ON field_attendance_violations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = user_id 
      AND users.reporting_manager_id = auth.uid()
    )
  );

-- HR and Admin can view all violations
CREATE POLICY "HR and Admin can view all violations"
  ON field_attendance_violations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role_id IN ('admin', 'hr')
    )
  );

-- System can create violations (via service role)
CREATE POLICY "System can create violations"
  ON field_attendance_violations FOR INSERT
  WITH CHECK (true);

-- Managers can update (acknowledge) their team's violations
CREATE POLICY "Managers can acknowledge violations"
  ON field_attendance_violations FOR UPDATE
  USING (
    acknowledged_by = auth.uid() OR
    escalated_to = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = user_id 
      AND users.reporting_manager_id = auth.uid()
    )
  );

-- Add audit trigger
CREATE TRIGGER update_violations_updated_at
  BEFORE UPDATE ON field_attendance_violations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
