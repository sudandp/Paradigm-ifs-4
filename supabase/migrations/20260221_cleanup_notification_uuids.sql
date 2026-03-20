-- Migration to replace UUIDs with names in security notifications
DO $$
DECLARE
    notif_record RECORD;
    user_name TEXT;
BEGIN
    FOR notif_record IN 
        SELECT id, message, user_id, 
               (regexp_matches(message, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', 'i'))[1] as found_uuid
        FROM public.notifications
        WHERE (type = 'security' OR message ILIKE '%violation%')
          AND message ~ '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
    LOOP
        -- Find the name of the user whose UUID is in the message
        -- Note: the UUID in the message might NOT be the recipient (user_id), but the actor.
        SELECT name INTO user_name FROM public.users WHERE id = notif_record.found_uuid::uuid;
        
        IF user_name IS NOT NULL THEN
            UPDATE public.notifications
            SET message = replace(message, notif_record.found_uuid, user_name)
            WHERE id = notif_record.id;
        END IF;
    END LOOP;
END $$;
