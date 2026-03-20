-- Migration: Add location_name column to attendance_events table
-- Date: 2026-01-02
-- Purpose: Store human-readable addresses directly in attendance events for faster report generation

-- Add location_name column to attendance_events table
ALTER TABLE public.attendance_events 
ADD COLUMN IF NOT EXISTS location_name TEXT;

-- Add comment to document the column
COMMENT ON COLUMN public.attendance_events.location_name IS 'Human-readable address or location name for this attendance event';

-- Create index for faster filtering/searching by location name
CREATE INDEX IF NOT EXISTS idx_attendance_events_location_name 
ON public.attendance_events(location_name);
