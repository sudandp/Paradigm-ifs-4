-- Migration: Backfill sqft for all staff (including office staff) where it was not calculated previously
UPDATE attendance_events
SET sqft = steps * 20
WHERE steps IS NOT NULL AND steps > 0 AND (sqft IS NULL OR sqft = 0);
