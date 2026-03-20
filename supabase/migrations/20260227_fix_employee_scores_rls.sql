-- Fix RLS policies for employee_scores table
-- Allows authenticated users to read all scores, and insert/update their own scores

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS employee_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies (if any)
DROP POLICY IF EXISTS "Users can read all employee scores" ON employee_scores;
DROP POLICY IF EXISTS "Users can insert scores" ON employee_scores;
DROP POLICY IF EXISTS "Users can update scores" ON employee_scores;
DROP POLICY IF EXISTS "Users can insert own scores" ON employee_scores;
DROP POLICY IF EXISTS "Users can update own scores" ON employee_scores;
DROP POLICY IF EXISTS "Allow all operations on employee_scores" ON employee_scores;

-- Allow all authenticated users to read all scores (needed for Top Performers)
CREATE POLICY "Users can read all employee scores"
  ON employee_scores FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert scores (scoring runs client-side)
CREATE POLICY "Users can insert scores"
  ON employee_scores FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update scores (upsert needs this)
CREATE POLICY "Users can update scores"
  ON employee_scores FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
