-- Migration to add missing columns to attendance_events table
-- These columns are required for independent flow tracking (Punch/Site/Break)
-- and for optional features like custom notes, attachments, and overtime.

ALTER TABLE public.attendance_events 
ADD COLUMN IF NOT EXISTS work_type text,
ADD COLUMN IF NOT EXISTS checkout_note text,
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS field_report_id uuid,
ADD COLUMN IF NOT EXISTS is_ot boolean default false,
ADD COLUMN IF NOT EXISTS device_id text,
ADD COLUMN IF NOT EXISTS is_manual boolean default false,
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS reason text;

-- Add index on work_type to speed up filtering in authStore
CREATE INDEX IF NOT EXISTS attendance_events_work_type_idx ON public.attendance_events(work_type);
