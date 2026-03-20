-- Employee Scoring System: Create the employee_scores table
-- Run this migration in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS employee_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First day of month, e.g. '2026-02-01'
  performance_score INTEGER NOT NULL DEFAULT 0 CHECK (performance_score >= 0 AND performance_score <= 100),
  attendance_score INTEGER NOT NULL DEFAULT 0 CHECK (attendance_score >= 0 AND attendance_score <= 100),
  response_score INTEGER NOT NULL DEFAULT 0 CHECK (response_score >= 0 AND response_score <= 100),
  overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  role_category TEXT NOT NULL DEFAULT 'office_staff' CHECK (role_category IN ('office_staff', 'field_staff', 'support')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Ensure one score per user per month
  UNIQUE(user_id, month)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_employee_scores_user_month ON employee_scores(user_id, month DESC);

-- RLS Policies
ALTER TABLE employee_scores ENABLE ROW LEVEL SECURITY;

-- Users can read their own scores
CREATE POLICY "Users can view own scores"
  ON employee_scores FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all scores
CREATE POLICY "Admins can view all scores"
  ON employee_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role_id IN ('admin', 'management')
    )
  );

-- Service role / authenticated users can insert/update their own scores
CREATE POLICY "Users can upsert own scores"
  ON employee_scores FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
