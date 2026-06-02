-- Migration: Add travel_distance field to attendance_events
ALTER TABLE public.attendance_events 
ADD COLUMN IF NOT EXISTS travel_distance double precision;
