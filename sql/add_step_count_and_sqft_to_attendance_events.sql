-- Migration: Add steps and sqft fields to attendance_events
ALTER TABLE public.attendance_events 
ADD COLUMN IF NOT EXISTS steps integer,
ADD COLUMN IF NOT EXISTS sqft double precision;
