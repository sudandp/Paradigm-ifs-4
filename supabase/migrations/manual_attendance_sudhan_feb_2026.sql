-- Manual Attendance for Sudhan M (Feb 2026)
-- Dates: Feb 4, 8, 12, 14, 16 (11 AM to 8 PM)
-- Date: Feb 17 (11 AM Punch In)
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
        -- Feb 4, 2026
        (sudhan_id, '2026-02-04 11:00:00+05:30', 'check-in', 'PIFMS Bangalore'),
        (sudhan_id, '2026-02-04 20:00:00+05:30', 'check-out', 'PIFMS Bangalore'),
        
        -- Feb 8, 2026
        (sudhan_id, '2026-02-08 11:00:00+05:30', 'check-in', 'PIFMS Bangalore'),
        (sudhan_id, '2026-02-08 20:00:00+05:30', 'check-out', 'PIFMS Bangalore'),
        
        -- Feb 12, 2026
        (sudhan_id, '2026-02-12 11:00:00+05:30', 'check-in', 'PIFMS Bangalore'),
        (sudhan_id, '2026-02-12 20:00:00+05:30', 'check-out', 'PIFMS Bangalore'),
        
        -- Feb 14, 2026
        (sudhan_id, '2026-02-14 11:00:00+05:30', 'check-in', 'PIFMS Bangalore'),
        (sudhan_id, '2026-02-14 20:00:00+05:30', 'check-out', 'PIFMS Bangalore'),

        -- Feb 16, 2026
        (sudhan_id, '2026-02-16 11:00:00+05:30', 'check-in', 'PIFMS Bangalore'),
        (sudhan_id, '2026-02-16 20:00:00+05:30', 'check-out', 'PIFMS Bangalore'),

        -- Feb 17, 2026 (Punch in only)
        (sudhan_id, '2026-02-17 11:00:00+05:30', 'check-in', 'PIFMS Bangalore');

    RAISE NOTICE 'Attendance entries created successfully for % (ID: %)', 'Sudhan M', sudhan_id;
END $$;
