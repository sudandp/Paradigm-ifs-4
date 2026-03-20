-- Migration: 20260306_update_office_ot_threshold.sql
-- Description: Updates the maximum daily working hours for office staff to 8 hours.

UPDATE public.settings
SET attendance_settings = jsonb_set(
    attendance_settings,
    '{office,daily_working_hours,max}',
    '8'::jsonb
)
WHERE id = 'singleton';
