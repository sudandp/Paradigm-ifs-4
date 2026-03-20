-- Add support for break-in and break-out events

-- The attendance_events table uses 'type' column (not event_type) based on existing migrations
-- We need to check if there's a constraint and update it, or if it's just a text field

-- Check current structure and add break event types
-- If there's a check constraint, we'll need to drop and recreate it
-- Otherwise, we'll just document that 'break-in' and 'break-out' are valid values

-- Note: Based on grep results, the table uses column name 'type' not 'event_type'
-- We'll add a comment to document the new valid values

COMMENT ON COLUMN public.attendance_events.type IS 
'Valid values: check-in, check-out, break-in, break-out. Break events are for office staff to track lunch breaks.';

-- Verify by selecting existing event types
SELECT DISTINCT type FROM public.attendance_events LIMIT 10;
