-- Migration: 20260217_fix_cryptic_notifications.sql
-- Goal: Replace user IDs with user names in existing escalation notifications.

DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN (
        SELECT id, name FROM public.users
    ) LOOP
        -- Update notifications where the message contains the user's UUID
        -- Also fix "HR/Admin" to "Admin"
        UPDATE public.notifications
        SET message = REPLACE(
            REPLACE(message, rec.id::text, rec.name),
            'escalated to HR/Admin',
            'escalated to Admin'
        )
        WHERE message ILIKE '%' || rec.id::text || '%'
        AND (
            message ILIKE '%Field attendance violation%' OR 
            message ILIKE '%URGENT:%'
        );
    END LOOP;

    -- Also fix records that already have names but still say HR/Admin
    UPDATE public.notifications
    SET message = REPLACE(message, 'escalated to HR/Admin', 'escalated to Admin')
    WHERE message ILIKE '%Field attendance violation%'
    AND message ILIKE '%HR/Admin%';
END $$;
