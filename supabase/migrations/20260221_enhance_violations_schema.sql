-- Migration to enhance violation tracking with structured data and severity

-- 1. Enhance attendance_violations (Geofencing)
ALTER TABLE public.attendance_violations 
ADD COLUMN IF NOT EXISTS violation_type TEXT,
ADD COLUMN IF NOT EXISTS violation_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Low';

-- 2. Enhance field_attendance_violations (Site/Travel)
-- Note: violation_type already exists in some scripts, but we ensure it's there and add others
ALTER TABLE public.field_attendance_violations 
ADD COLUMN IF NOT EXISTS violation_details JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Low';

-- 3. Enhance notifications
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Low',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 4. Update existing records (optional but good for consistency)
UPDATE public.attendance_violations SET severity = 'Low' WHERE severity IS NULL;
UPDATE public.field_attendance_violations SET severity = 'Low' WHERE severity IS NULL;
UPDATE public.notifications SET severity = 'Low' WHERE severity IS NULL;
UPDATE public.attendance_violations SET violation_details = '{}'::jsonb WHERE violation_details IS NULL;
UPDATE public.field_attendance_violations SET violation_details = '{}'::jsonb WHERE violation_details IS NULL;
UPDATE public.notifications SET metadata = '{}'::jsonb WHERE metadata IS NULL;
