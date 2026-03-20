-- Manual Attendance for Sudhan M (Jan/Feb 2026)
-- Dates: Jan 12, 29, 31 and Feb 3
-- Timing: 10 AM to 7 PM
-- Location: PIFMS Bangalore

DO $$
DECLARE
    sudhan_id UUID;
BEGIN
    -- 1. Find Sudhan M's ID
    SELECT id INTO sudhan_id FROM public.users WHERE name ILIKE '%sudhan M%' LIMIT 1;
    
    IF sudhan_id IS NULL THEN
        RAISE EXCEPTION 'User "Sudhan M" not found';
    END IF;

    -- 2. Insert Attendance Events
    INSERT INTO public.attendance_events (user_id, timestamp, type, location_name)
    VALUES 
        -- Jan 12, 2026
        (sudhan_id, '2026-01-12 10:00:00+05:30', 'check-in', 'PIFMS Bangalore'),
        (sudhan_id, '2026-01-12 19:00:00+05:30', 'check-out', 'PIFMS Bangalore'),
        
        -- Jan 29, 2026
        (sudhan_id, '2026-01-29 10:00:00+05:30', 'check-in', 'PIFMS Bangalore'),
        (sudhan_id, '2026-01-29 19:00:00+05:30', 'check-out', 'PIFMS Bangalore'),
        
        -- Jan 31, 2026
        (sudhan_id, '2026-01-31 10:00:00+05:30', 'check-in', 'PIFMS Bangalore'),
        (sudhan_id, '2026-01-31 19:00:00+05:30', 'check-out', 'PIFMS Bangalore'),
        
        -- Feb 3, 2026
        (sudhan_id, '2026-02-03 10:00:00+05:30', 'check-in', 'PIFMS Bangalore'),
        (sudhan_id, '2026-02-03 19:00:00+05:30', 'check-out', 'PIFMS Bangalore');

    RAISE NOTICE 'Attendance entries created successfully for % (ID: %)', 'Sudhan M', sudhan_id;
END $$;
