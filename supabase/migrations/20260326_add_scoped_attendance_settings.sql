-- Migration: Create Scoped Attendance Settings Table
-- Description: Stores attendance and leave rules for various scopes: Global, Location, Company (Society), and Entity (Site).

CREATE TABLE IF NOT EXISTS public.attendance_settings_scopes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('location', 'company', 'entity')),
    scope_id TEXT NOT NULL,
    settings JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(scope_type, scope_id)
);

-- RLS Policies
ALTER TABLE public.attendance_settings_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to attendance_settings_scopes"
ON public.attendance_settings_scopes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Clean up previous temporary tables if they exist
DROP TABLE IF EXISTS public.location_attendance_settings;
DROP TABLE IF EXISTS public.entity_attendance_settings;
