-- Add office hours configuration and break tracking support

-- 1. Update office attendance settings with fixed hours configuration
UPDATE public.settings
SET attendance_settings = jsonb_set(
    attendance_settings,
    '{office}',
    (attendance_settings->'office' || '{
        "fixedOfficeHours": {
            "checkInTime": "09:00",
            "checkOutTime": "18:00"
        },
        "dailyWorkingHours": {
            "min": 7,
            "max": 9
        },
        "monthlyTargetHours": 216,
        "enableHoursBasedCalculation": true,
        "enableBreakTracking": true,
        "lunchBreakDuration": 60,
        "maxHolidaysPerCategory": 12,
        "adminAllocatedHolidays": 7,
        "employeeHolidays": 5
    }'::jsonb),
    true
)
WHERE id = 'singleton';

-- 2. Verify the update
SELECT 
    attendance_settings->'office'->'fixedOfficeHours' as fixed_hours,
    attendance_settings->'office'->'enableBreakTracking' as break_tracking
FROM public.settings 
WHERE id = 'singleton';
