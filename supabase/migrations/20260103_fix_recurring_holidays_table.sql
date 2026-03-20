
-- The application fetches recurring holidays from the 'recurring_holidays' table, 
-- NOT from the attendance_settings in the settings table.
-- This script adds the 3rd Saturday for both Office and Field staff to the correct table.

-- Clear any existing 3rd Saturday rules to avoid duplicates
DELETE FROM public.recurring_holidays 
WHERE day = 'Saturday' AND occurrence = 3;

-- Insert the rules for both categories
INSERT INTO public.recurring_holidays (role_type, day, occurrence)
VALUES 
    ('office', 'Saturday', 3),
    ('field', 'Saturday', 3);

-- Verify the table contents
SELECT id, role_type, day, occurrence FROM public.recurring_holidays;
