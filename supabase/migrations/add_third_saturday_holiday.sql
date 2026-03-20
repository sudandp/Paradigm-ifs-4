-- Add 3rd Saturday as recurring holiday for office/back office staff
-- This script adds the 3rd Saturday of every month as a holiday in the attendance_settings

-- First, check current settings (optional - uncomment to view)
-- SELECT attendance_settings FROM public.settings LIMIT 1;

-- Update the attendance_settings to include 3rd Saturday as a recurring holiday for office staff
UPDATE public.settings
SET attendance_settings = jsonb_set(
    COALESCE(attendance_settings, '{}'::jsonb),
    '{office,recurringHolidays}',
    COALESCE(
        attendance_settings->'office'->'recurringHolidays',
        '[]'::jsonb
    ) || '[{"day": "Saturday", "n": 3, "type": "office"}]'::jsonb
);

-- Verify the update (optional - uncomment to view)
-- SELECT attendance_settings->'office'->'recurringHolidays' as office_recurring_holidays
-- FROM public.settings LIMIT 1;
