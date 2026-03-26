-- Migration: Create Location Attendance Settings Table
-- Description: Stores per-location attendance and leave rules.

CREATE TABLE IF NOT EXISTS public.location_attendance_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    location TEXT NOT NULL UNIQUE,
    settings JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.location_attendance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to location_attendance_settings"
ON public.location_attendance_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Drop the previous table if it was created
DROP TABLE IF EXISTS public.entity_attendance_settings;
