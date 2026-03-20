-- Backfill Script: Update existing attendance events with location names
-- This script resolves addresses for historical attendance events that have coordinates but no location_name

-- First, let's see how many events need backfilling
SELECT COUNT(*) as events_needing_backfill
FROM public.attendance_events
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL 
  AND location_name IS NULL;

-- Option 1: If you have the location_cache table populated, use it to backfill
UPDATE public.attendance_events ae
SET location_name = lc.address
FROM public.location_cache lc
WHERE ae.latitude IS NOT NULL
  AND ae.longitude IS NOT NULL
  AND ae.location_name IS NULL
  AND ae.latitude::numeric = lc.latitude
  AND ae.longitude::numeric = lc.longitude;

-- Option 2: If events are within a defined geofence location, use the location name
UPDATE public.attendance_events ae
SET location_name = COALESCE(l.name, l.address)
FROM public.locations l
WHERE ae.latitude IS NOT NULL
  AND ae.longitude IS NOT NULL
  AND ae.location_name IS NULL
  AND ae.location_id = l.id;

-- Verify the update
SELECT COUNT(*) as events_still_needing_backfill
FROM public.attendance_events
WHERE latitude IS NOT NULL 
  AND longitude IS NOT NULL 
  AND location_name IS NULL;
