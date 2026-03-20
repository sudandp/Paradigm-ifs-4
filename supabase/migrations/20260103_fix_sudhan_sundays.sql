-- Split Sick Leave for Sudhan M to exclude Sundays (Dec 7th and 14th)

DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. Get User ID for Sudhan M
    SELECT id INTO target_user_id FROM auth.users 
    WHERE raw_user_meta_data->>'name' ILIKE '%Sudhan M%' LIMIT 1;

    -- If not found in auth.users, try public.users (depending on your schema)
    IF target_user_id IS NULL THEN
        SELECT id INTO target_user_id FROM public.users 
        WHERE name ILIKE '%Sudhan M%' LIMIT 1;
    END IF;

    IF target_user_id IS NOT NULL THEN
        
        -- 2. DELETE the original 15-day leave request (Dec 5-19)
        DELETE FROM public.leave_requests 
        WHERE user_id = target_user_id 
        AND start_date = '2025-12-05' 
        AND end_date = '2025-12-19';

        -- 3. INSERT split leave requests to skip Sundays
        
        -- Part 1: Dec 5 - Dec 6 (Fri - Sat)
        INSERT INTO public.leave_requests (user_id, leave_type, start_date, end_date, reason, status, approval_history)
        VALUES (
            target_user_id, 
            'Sick', 
            '2025-12-05', 
            '2025-12-06', 
            'Sick Leave (Part 1)', 
            'approved',
            '[]'::jsonb
        );

        -- Part 2: Dec 8 - Dec 13 (Mon - Sat)
        -- Skips Dec 7 (Sunday)
        INSERT INTO public.leave_requests (user_id, leave_type, start_date, end_date, reason, status, approval_history)
        VALUES (
            target_user_id, 
            'Sick', 
            '2025-12-08', 
            '2025-12-13', 
            'Sick Leave (Part 2)', 
            'approved',
            '[]'::jsonb
        );

        -- Part 3: Dec 15 - Dec 19 (Mon - Fri)
        -- Skips Dec 14 (Sunday)
        INSERT INTO public.leave_requests (user_id, leave_type, start_date, end_date, reason, status, approval_history)
        VALUES (
            target_user_id, 
            'Sick', 
            '2025-12-15', 
            '2025-12-19', 
            'Sick Leave (Part 3)', 
            'approved',
            '[]'::jsonb
        );

    END IF;
END $$;
