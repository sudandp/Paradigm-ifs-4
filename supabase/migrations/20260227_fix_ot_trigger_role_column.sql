-- Migration: 20260227_fix_ot_trigger_role_column.sql
-- Description: Fixes the process_ot_after_checkout trigger function which references
--              non-existent column u.role instead of u.role_id on the users table.
--              This was causing a 400 Bad Request (42703: column u.role does not exist)
--              on every attendance event INSERT (punch-in/out).

CREATE OR REPLACE FUNCTION public.process_ot_after_checkout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    prev_check_in timestamptz;
    work_duration_min int;
    work_duration_hours numeric;
    user_role_name text;
    staff_cat text;
    std_hours_max numeric := 8; -- Default fallback
    daily_ot numeric := 0;
    settings_jsonb jsonb;
    u_manager_id uuid;
    u_name text;
BEGIN
    -- Only process punch-outs
    IF NEW.type != 'punch-out' THEN
        RETURN NEW;
    END IF;

    -- 1. Find the corresponding punch-in
    SELECT timestamp INTO prev_check_in
    FROM public.attendance_events
    WHERE user_id = NEW.user_id
    AND type = 'punch-in'
    AND timestamp < NEW.timestamp
    ORDER BY timestamp DESC
    LIMIT 1;

    IF prev_check_in IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Calculate worked hours
    work_duration_min := EXTRACT(EPOCH FROM (NEW.timestamp - prev_check_in)) / 60;
    work_duration_hours := work_duration_min / 60.0;

    -- 3. Get User Role and Settings (FIX: use role_id instead of role)
    SELECT u.role_id, u.reporting_manager_id, u.name 
    INTO user_role_name, u_manager_id, u_name
    FROM public.users u WHERE u.id = NEW.user_id;

    -- Determine Staff Category
    staff_cat := 'field'; -- Default
    IF user_role_name IN (
        'admin', 'hr', 'finance', 'developer', 'management', 'office_staff', 
        'back_office_staff', 'bd', 'operation_manager', 'field_staff',
        'finance_manager', 'hr_ops', 'business developer', 'unverified',
        'operation manager', 'field staff', 'finance manager', 'hr ops'
    ) THEN
        staff_cat := 'office';
    ELSIF user_role_name IN ('site_manager', 'site_supervisor', 'site manager', 'site supervisor') THEN
        staff_cat := 'site';
    END IF;

    -- 4. Get Dynamic Threshold
    SELECT attendance_settings INTO settings_jsonb FROM public.settings WHERE id = 'singleton';
    
    IF settings_jsonb ? staff_cat AND (settings_jsonb->staff_cat) ? 'dailyWorkingHours' THEN
        std_hours_max := (settings_jsonb->staff_cat->'dailyWorkingHours'->>'max')::numeric;
    END IF;

    -- 5. Calculate OT
    IF work_duration_hours > std_hours_max THEN
        daily_ot := work_duration_hours - std_hours_max;
        
        -- 6. Update User OT Balances
        UPDATE public.users 
        SET 
            ot_hours_bank = ot_hours_bank + daily_ot,
            monthly_ot_hours = monthly_ot_hours + daily_ot
        WHERE id = NEW.user_id;

        -- 7. Check for Comp Off Conversion
        DECLARE
            curr_bank numeric;
            compoff_count int;
        BEGIN
            SELECT ot_hours_bank INTO curr_bank FROM public.users WHERE id = NEW.user_id;
            
            IF curr_bank >= 8 THEN
                compoff_count := floor(curr_bank / 8)::int;
                
                -- Create Comp Off Logs
                FOR i IN 1..compoff_count LOOP
                    INSERT INTO public.comp_off_logs (
                        user_id, user_name, date_earned, reason, status, granted_by_name
                    ) VALUES (
                        NEW.user_id, u_name, CURRENT_DATE, 'Automatic OT conversion', 'earned', 'System'
                    );
                END LOOP;

                -- Deduct from bank
                UPDATE public.users 
                SET ot_hours_bank = ot_hours_bank - (compoff_count * 8)
                WHERE id = NEW.user_id;

                -- 8. Notify User
                INSERT INTO public.notifications (user_id, message, type, link_to)
                VALUES (
                    NEW.user_id, 
                    format('Congratulations! You earned %s Comp Off(s) from accumulated Overtime.', compoff_count),
                    'success', 
                    '/leaves'
                );

                -- 9. Notify Manager
                IF u_manager_id IS NOT NULL THEN
                    INSERT INTO public.notifications (user_id, message, type, link_to)
                    VALUES (
                        u_manager_id,
                        format('%s has earned %s Comp Off(s) via automatic OT conversion.', u_name, compoff_count),
                        'info',
                        '/team'
                    );
                END IF;
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$;
