-- Migration: 20260223_fix_notification_metadata.sql
-- Goal: Ensure columns exist and backfill missing employeeName metadata for security notifications.

-- 1. Ensure columns exist (Self-healing in case previous migrations were skipped)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'Low';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

DO $$
DECLARE
    rec RECORD;
BEGIN
    -- 2. Iterate through all users to find notifications with their name in the message
    FOR rec IN (
        SELECT id, name FROM public.users
    ) LOOP
        -- Update notifications where the message contains the user's name
        -- and the metadata is missing the employeeName property
        UPDATE public.notifications
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('employeeName', rec.name)
        WHERE (
            message ILIKE '%' || rec.name || '%'
        )
        AND (
            metadata IS NULL OR 
            NOT (metadata ? 'employeeName')
        )
        AND (
            type = 'security' OR
            message ILIKE '%Field attendance violation%' OR 
            message ILIKE '%URGENT:%'
        );
    END LOOP;

    -- 3. Ensure all 'security' notifications have some metadata if null
    UPDATE public.notifications
    SET metadata = '{}'::jsonb
    WHERE metadata IS NULL AND type = 'security';

END $$;
