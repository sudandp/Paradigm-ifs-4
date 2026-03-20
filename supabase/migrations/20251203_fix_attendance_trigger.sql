-- Fix broken trigger and function by using correct column names (type, timestamp)

-- 1. Drop the broken trigger and functions first
DROP TRIGGER IF EXISTS on_check_out_approval ON public.attendance_events;
DROP FUNCTION IF EXISTS public.trigger_overnight_approval();
DROP FUNCTION IF EXISTS public.handle_smart_auto_logout();

-- 2. Re-create Smart Auto-Logout Function with correct columns
CREATE OR REPLACE FUNCTION public.handle_smart_auto_logout()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    auto_logout_threshold_hours int := 12;
    overnight_start_hour int := 18;
    overnight_end_hour int := 8;
    current_hour int;
BEGIN
    current_hour := EXTRACT(HOUR FROM now());

    FOR r IN
        SELECT ae.id, ae.user_id, ae.timestamp, ae.created_at
        FROM public.attendance_events ae
        WHERE ae.type = 'check_in'  -- Changed from event_type to type
        AND NOT EXISTS (
            SELECT 1 FROM public.attendance_events out_event
            WHERE out_event.user_id = ae.user_id
            AND out_event.type = 'check_out' -- Changed from event_type to type
            AND out_event.timestamp > ae.timestamp -- Changed from event_time to timestamp
        )
        AND ae.timestamp < now() - interval '12 hours' -- Changed from event_time to timestamp
    LOOP
        IF (EXTRACT(EPOCH FROM (now() - r.timestamp))/3600) > 16 THEN
             INSERT INTO public.attendance_events (user_id, type, timestamp, created_at)
             VALUES (r.user_id, 'check_out', now(), now());
             
        ELSIF (EXTRACT(EPOCH FROM (now() - r.timestamp))/3600) > 12 THEN
             IF EXTRACT(HOUR FROM r.timestamp) < overnight_start_hour THEN
                 INSERT INTO public.attendance_events (user_id, type, timestamp, created_at)
                 VALUES (r.user_id, 'check_out', now(), now());
             END IF;
        END IF;
    END LOOP;
END;
$$;

-- 3. Re-create Trigger Function with correct columns
CREATE OR REPLACE FUNCTION public.trigger_overnight_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    last_check_in timestamptz;
    shift_start_hour int;
BEGIN
    -- Changed NEW.event_type to NEW.type
    IF NEW.type = 'check_out' THEN
        -- Find corresponding check-in
        SELECT timestamp INTO last_check_in -- Changed event_time to timestamp
        FROM public.attendance_events
        WHERE user_id = NEW.user_id
        AND type = 'check_in' -- Changed event_type to type
        AND timestamp < NEW.timestamp -- Changed event_time to timestamp
        ORDER BY timestamp DESC -- Changed event_time to timestamp
        LIMIT 1;

        IF last_check_in IS NOT NULL THEN
            shift_start_hour := EXTRACT(HOUR FROM last_check_in);
            
            IF shift_start_hour >= 18 OR shift_start_hour < 6 THEN
                 INSERT INTO public.attendance_approvals (user_id, check_in_time, check_out_time, status)
                 VALUES (NEW.user_id, last_check_in, NEW.timestamp, 'pending'); -- Changed NEW.event_time to NEW.timestamp
                 
                 INSERT INTO public.notifications (user_id, message, type, link)
                 SELECT u.reporting_manager_id, 'Approval required for overnight shift: ' || (SELECT name FROM public.users WHERE id = NEW.user_id), 'info', '/attendance/approvals'
                 FROM public.users u
                 WHERE u.id = NEW.user_id AND u.reporting_manager_id IS NOT NULL;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 4. Re-attach Trigger
CREATE TRIGGER on_check_out_approval
AFTER INSERT ON public.attendance_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_overnight_approval();
