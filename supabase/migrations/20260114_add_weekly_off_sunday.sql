-- Add Sunday as weekly off for all staff categories
-- Sunday = 0 in JavaScript Date.getDay()

-- 1. Update office staff settings to include Sunday as weekly off
UPDATE public.settings
SET attendance_settings = jsonb_set(
    attendance_settings,
    '{office,weeklyOffDays}',
    '[0]'::jsonb,
    true
)
WHERE id = 'singleton';

-- 2. Update field staff settings to include Sunday as weekly off
UPDATE public.settings
SET attendance_settings = jsonb_set(
    attendance_settings,
    '{field,weeklyOffDays}',
    '[0]'::jsonb,
    true
)
WHERE id = 'singleton';

-- 3. Update site staff settings to include Sunday as weekly off
UPDATE public.settings
SET attendance_settings = jsonb_set(
    attendance_settings,
    '{site,weeklyOffDays}',
    '[0]'::jsonb,
    true
)
WHERE id = 'singleton';

-- 4. Verify the updates
SELECT 
    attendance_settings->'office'->'weeklyOffDays' as office_weekly_off,
    attendance_settings->'field'->'weeklyOffDays' as field_weekly_off,
    attendance_settings->'site'->'weeklyOffDays' as site_weekly_off
FROM public.settings 
WHERE id = 'singleton';
