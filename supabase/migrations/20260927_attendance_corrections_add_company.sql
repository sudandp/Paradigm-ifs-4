-- 20260927_attendance_corrections_add_company.sql
-- Add missing 'company' column to attendance_corrections table
-- This column is written by the frontend correction save flow but was absent from the original schema.

ALTER TABLE public.attendance_corrections
  ADD COLUMN IF NOT EXISTS company TEXT;
