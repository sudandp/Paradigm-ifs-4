-- Migration: Update Admin Device Limits and Clear Logs
-- Description: Sets Admin device limits to 5 Web, 2 Android, 2 iOS and clears existing device logs
-- Created: 2026-01-28

-- 1. Update settings with new admin limits
UPDATE public.settings 
SET attendance_settings = jsonb_set(
    COALESCE(attendance_settings, '{}'::jsonb),
    '{deviceLimits}',
    (COALESCE(attendance_settings->'deviceLimits', '{}'::jsonb) || 
    '{
        "admin": {
            "web": 5,
            "android": 2,
            "ios": 2
        },
        "officeStaff": {
            "web": 1,
            "android": 1,
            "ios": 1
        },
        "fieldStaff": {
            "web": 1,
            "android": 1,
            "ios": 1
        },
        "siteStaff": {
            "web": 1,
            "android": 1,
            "ios": 1
        }
    }'::jsonb)
)
WHERE id = 'singleton';

-- 2. Clear existing device logs and registrations
TRUNCATE TABLE public.device_activity_logs CASCADE;
TRUNCATE TABLE public.device_change_requests CASCADE;
TRUNCATE TABLE public.user_devices CASCADE;
