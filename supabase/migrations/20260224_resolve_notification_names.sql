-- Migration: 20260224_resolve_notification_names.sql
-- Goal: Resolve employee names in existing notifications by updating message and metadata.

DO $$
DECLARE
    rec RECORD;
    user_rec RECORD;
    updated_message TEXT;
    updated_metadata JSONB;
BEGIN
    -- 1. Loop through all security notifications
    FOR rec IN (
        SELECT id, message, metadata FROM public.notifications 
        WHERE type = 'security' OR message ILIKE '%Field attendance violation%'
    ) LOOP
        updated_message := rec.message;
        updated_metadata := rec.metadata;

        -- 2. Try to find a user name match
        -- We iterate through users to find if their ID is in the message or metadata
        FOR user_rec IN (SELECT id, name FROM public.users) LOOP
            -- Check if user ID is in the message or already in metadata
            IF updated_message ILIKE '%' || user_rec.id::text || '%' OR 
               (updated_metadata->>'employeeId')::text = user_rec.id::text THEN
                
                -- Update message: Replace UUID with Name
                updated_message := REPLACE(updated_message, user_rec.id::text, user_rec.name);
                
                -- Update metadata: Set employeeName
                updated_metadata := jsonb_set(
                    COALESCE(updated_metadata, '{}'::jsonb),
                    '{employeeName}',
                    to_jsonb(user_rec.name)
                );
                
                -- Also ensure employeeId is set if we found it in the message
                IF updated_metadata->>'employeeId' IS NULL THEN
                    updated_metadata := jsonb_set(
                        updated_metadata,
                        '{employeeId}',
                        to_jsonb(user_rec.id::text)
                    );
                END IF;
            END IF;
        END LOOP;

        -- 3. Final cleanup for wording
        updated_message := REPLACE(updated_message, 'escalated to HR/Admin', 'escalated to Admin');
        
        -- 4. Update the notification record if anything changed
        IF updated_message <> rec.message OR updated_metadata <> rec.metadata THEN
            UPDATE public.notifications
            SET 
                message = updated_message,
                metadata = updated_metadata
            WHERE id = rec.id;
        END IF;

    END LOOP;

    -- 5. Generic cleanup for any remaining "HR/Admin"
    UPDATE public.notifications
    SET message = REPLACE(message, 'escalated to HR/Admin', 'escalated to Admin')
    WHERE message ILIKE '%HR/Admin%';

END $$;
