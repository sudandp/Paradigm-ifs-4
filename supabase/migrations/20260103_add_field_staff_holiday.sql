-- 1. Ensure 'office' and 'field' keys exist in attendance_settings
UPDATE public.settings
SET attendance_settings = jsonb_set(
    jsonb_set(
        COALESCE(attendance_settings, '{}'::jsonb),
        '{office}',
        COALESCE(attendance_settings->'office', '{}'::jsonb),
        true
    ),
    '{field}',
    COALESCE(attendance_settings->'field', '{}'::jsonb),
    true
);

-- 2. Add 3rd Saturday for Office Staff (if not already present)
UPDATE public.settings
SET attendance_settings = jsonb_set(
    attendance_settings,
    '{office,recurringHolidays}',
    COALESCE(attendance_settings->'office'->'recurringHolidays', '[]'::jsonb) || '[{"day": "Saturday", "n": 3, "type": "office"}]'::jsonb
)
WHERE NOT (attendance_settings->'office'->'recurringHolidays' @> '[{"day": "Saturday", "n": 3}]'::jsonb);

-- 3. Add 3rd Saturday for Field Staff (if not already present)
UPDATE public.settings
SET attendance_settings = jsonb_set(
    attendance_settings,
    '{field,recurringHolidays}',
    COALESCE(attendance_settings->'field'->'recurringHolidays', '[]'::jsonb) || '[{"day": "Saturday", "n": 3, "type": "field"}]'::jsonb
)
WHERE attendance_settings->'field'->'recurringHolidays' IS NULL 
   OR NOT (attendance_settings->'field'->'recurringHolidays' @> '[{"day": "Saturday", "n": 3}]'::jsonb);

-- Verify the update
SELECT 
    attendance_settings->'office'->'recurringHolidays' as office_rules,
    attendance_settings->'field'->'recurringHolidays' as field_rules
FROM public.settings LIMIT 1;
