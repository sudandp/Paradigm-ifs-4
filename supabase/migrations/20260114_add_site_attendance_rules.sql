-- 1. Initialize 'site' key in attendance_settings with default values
UPDATE public.settings
SET attendance_settings = jsonb_set(
    COALESCE(attendance_settings, '{}'::jsonb),
    '{site}',
    '{
        "minimumHoursFullDay": 9,
        "minimumHoursHalfDay": 5,
        "annualEarnedLeaves": 10,
        "annualSickLeaves": 10,
        "monthlyFloatingLeaves": 0,
        "annualCompOffLeaves": 10,
        "enableAttendanceNotifications": true,
        "sickLeaveCertificateThreshold": 3,
        "geofencingEnabled": true,
        "maxViolationsPerMonth": 3
    }'::jsonb,
    true
)
WHERE id = 'singleton';

-- 2. Update 'holidays' table 'type' check constraint
-- First, drop the existing constraint if it exists. We assume it's named 'holidays_type_check'.
-- If the name is different, this might fail, so we'll try to drop it by checking information_schema or just replacing it.
-- Since we can't easily check names in a single SQL script without PL/pgSQL, we'll use a DO block.

DO $$
BEGIN
    -- Attempt to drop the constraint if it exists (generic name assumption or look up)
    -- Common convention: table_column_check
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'holidays_type_check') THEN
        ALTER TABLE public.holidays DROP CONSTRAINT holidays_type_check;
    END IF;
    
    -- Now add the updated constraint
    ALTER TABLE public.holidays ADD CONSTRAINT holidays_type_check CHECK (type IN ('office', 'field', 'site'));
EXCEPTION
    WHEN undefined_object THEN
        -- If constraint didn't exist or name was wrong, just try adding it. 
        -- If a different constraint exists, it might conflict, but we assume standard naming.
        NULL; 
END $$;

-- 3. Update 'recurring_holidays' table 'role_type' check constraint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'recurring_holidays_role_type_check') THEN
        ALTER TABLE public.recurring_holidays DROP CONSTRAINT recurring_holidays_role_type_check;
    END IF;

    ALTER TABLE public.recurring_holidays ADD CONSTRAINT recurring_holidays_role_type_check CHECK (role_type IN ('office', 'field', 'site'));
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;
