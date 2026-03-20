-- Migration: 20260218_fix_cryptic_notifications_v2.sql
-- Goal: Replace user IDs with user names in existing escalation notifications and fix wording.

DO $$
DECLARE
    rec RECORD;
BEGIN
    -- 1. Iterate through all users to replace IDs with names in violation notifications
    FOR rec IN (
        SELECT id, name FROM public.users
    ) LOOP
        -- Update notifications where the message contains the user's UUID
        -- Specifically target "Field attendance violation" and "URGENT" messages
        UPDATE public.notifications
        SET message = REPLACE(
            REPLACE(message, rec.id::text, rec.name),
            'escalated to HR/Admin',
            'escalated to Admin'
        )
        WHERE (
            message ILIKE '%' || rec.id::text || '%' OR
            message ILIKE '%escalated to HR/Admin%'
        )
        AND (
            message ILIKE '%Field attendance violation%' OR 
            message ILIKE '%URGENT:%'
        );
    END LOOP;

    -- 2. Clean up any remaining "HR/Admin" to "Admin" wording for violation notifications
    UPDATE public.notifications
    SET message = REPLACE(message, 'escalated to HR/Admin', 'escalated to Admin')
    WHERE message ILIKE '%Field attendance violation%'
    AND message ILIKE '%HR/Admin%';

END $$;
