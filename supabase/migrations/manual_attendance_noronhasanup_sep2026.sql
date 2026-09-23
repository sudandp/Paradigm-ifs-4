-- ============================================================================
-- MANUAL ATTENDANCE EVENTS: noronhasanup@gmail.com
-- Period : 09-Sep-2026 to 15-Sep-2026
-- Target : public.users, public.attendance_events (Supabase)
-- Notes  : 
--   1. Ensures joining_date is '2026-09-01' so pre-employment filters do not
--      neutralize dates prior to Sep 15.
--   2. Break Start is 'break-in' and Break End is 'break-out'.
--   3. Sep 15 includes regularized punch-out to prevent 'Absent' on past date.
-- ============================================================================

DO $$
DECLARE
    target_user_id UUID;
    target_user_name TEXT;
BEGIN
    -- 1. Resolve User from email or name
    SELECT id, name INTO target_user_id, target_user_name
    FROM public.users
    WHERE email = 'noronhasanup@gmail.com' 
       OR name ILIKE '%noronha%'
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email "noronhasanup@gmail.com"';
    END IF;

    RAISE NOTICE 'Found user: % (ID: %)', target_user_name, target_user_id;

    -- 2. Adjust joining_date & opening dates so Sep 1-14 are eligible in Leave & Attendance Calendar
    UPDATE public.users
    SET 
        joining_date = '2026-09-01',
        earned_leave_opening_date = '2026-09-01',
        sick_leave_opening_date = '2026-09-01',
        comp_off_opening_date = '2026-09-01',
        floating_leave_opening_date = '2026-09-01',
        child_care_leave_opening_date = '2026-09-01'
    WHERE id = target_user_id;

    -- 3. Cleanup any existing attendance events for this specific date range
    DELETE FROM public.attendance_events
    WHERE user_id = target_user_id
      AND timestamp >= '2026-09-09 00:00:00+05:30'
      AND timestamp <= '2026-09-15 23:59:59+05:30';

    -- 4. Insert Attendance Events (Punch-in, Break-in, Break-out, Punch-out)
    -- All timestamps calibrated to Indian Standard Time (+05:30)
    -- Note: 'break-in' starts the break, 'break-out' ends the break
    INSERT INTO public.attendance_events (
        user_id,
        timestamp,
        type,
        location_name,
        is_manual,
        work_type,
        reason
    )
    VALUES
        -- ── 09-Sep-2026 (In: 9:35 AM | Break: 2:15 PM - 2:35 PM | Out: 6:10 PM) ──
        (target_user_id, '2026-09-09 09:35:00+05:30', 'punch-in',  'Office', true, 'office', 'Manual Adjustment - Excel Verified'),
        (target_user_id, '2026-09-09 14:15:00+05:30', 'break-in',  'Office', true, 'office', 'Lunch Break Start'),
        (target_user_id, '2026-09-09 14:35:00+05:30', 'break-out', 'Office', true, 'office', 'Lunch Break End'),
        (target_user_id, '2026-09-09 18:10:00+05:30', 'punch-out', 'Office', true, 'office', 'Manual Adjustment - Excel Verified'),

        -- ── 10-Sep-2026 (In: 9:05 AM | Break: 2:05 PM - 2:20 PM | Out: 7:00 PM) ──
        (target_user_id, '2026-09-10 09:05:00+05:30', 'punch-in',  'Office', true, 'office', 'Manual Adjustment - Excel Verified'),
        (target_user_id, '2026-09-10 14:05:00+05:30', 'break-in',  'Office', true, 'office', 'Lunch Break Start'),
        (target_user_id, '2026-09-10 14:20:00+05:30', 'break-out', 'Office', true, 'office', 'Lunch Break End'),
        (target_user_id, '2026-09-10 19:00:00+05:30', 'punch-out', 'Office', true, 'office', 'Manual Adjustment - Excel Verified'),

        -- ── 11-Sep-2026 (In: 9:15 AM | Break: 1:55 PM - 2:15 PM | Out: 7:20 PM) ──
        (target_user_id, '2026-09-11 09:15:00+05:30', 'punch-in',  'Office', true, 'office', 'Manual Adjustment - Excel Verified'),
        (target_user_id, '2026-09-11 13:55:00+05:30', 'break-in',  'Office', true, 'office', 'Lunch Break Start'),
        (target_user_id, '2026-09-11 14:15:00+05:30', 'break-out', 'Office', true, 'office', 'Lunch Break End'),
        (target_user_id, '2026-09-11 19:20:00+05:30', 'punch-out', 'Office', true, 'office', 'Manual Adjustment - Excel Verified'),

        -- ── 12-Sep-2026 (In: 9:25 AM | Break: 2:05 PM - 2:35 PM | Out: 7:35 PM) ──
        (target_user_id, '2026-09-12 09:25:00+05:30', 'punch-in',  'Office', true, 'office', 'Manual Adjustment - Excel Verified'),
        (target_user_id, '2026-09-12 14:05:00+05:30', 'break-in',  'Office', true, 'office', 'Lunch Break Start'),
        (target_user_id, '2026-09-12 14:35:00+05:30', 'break-out', 'Office', true, 'office', 'Lunch Break End'),
        (target_user_id, '2026-09-12 19:35:00+05:30', 'punch-out', 'Office', true, 'office', 'Manual Adjustment - Excel Verified'),

        -- ── 13-Sep-2026 : Sunday (Weekly Off - handled via calendar rules) ──
        -- ── 14-Sep-2026 : Ganesh Chaturthi (Holiday - handled via holidays table) ──

        -- ── 15-Sep-2026 (In: 9:15 AM | Regularized Out: 6:30 PM - App configured on phone today) ──
        (target_user_id, '2026-09-15 09:15:00+05:30', 'punch-in',  'Office', true, 'office', 'Attendance app configured today'),
        (target_user_id, '2026-09-15 18:30:00+05:30', 'punch-out', 'Office', true, 'office', 'Manual Adjustment - Regularized Out Punch');

    -- 5. Audit Log entry for tracking (optional, safe check)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_audit_logs') THEN
        INSERT INTO public.attendance_audit_logs (
            action,
            target_user_id,
            details
        )
        VALUES (
            'MANUAL_ENTRY',
            target_user_id,
            jsonb_build_object(
                'date_range', '2026-09-09 to 2026-09-15',
                'user_email', 'noronhasanup@gmail.com',
                'reason', 'Manual log entry for Sep 9-15 attendance with joining_date update'
            )
        );
    END IF;

    RAISE NOTICE 'Attendance events & joining date successfully updated for % (Sep 09 - Sep 15, 2026)', target_user_name;
END $$;


-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
SELECT 
    e.id,
    u.name,
    u.email,
    u.joining_date,
    TO_CHAR(e.timestamp AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH12:MI:SS AM') AS timestamp_ist,
    e.type,
    e.location_name,
    e.is_manual,
    e.reason
FROM public.attendance_events e
JOIN public.users u ON u.id = e.user_id
WHERE (u.email = 'noronhasanup@gmail.com' OR u.name ILIKE '%noronha%')
  AND e.timestamp >= '2026-09-09 00:00:00+05:30'
  AND e.timestamp <= '2026-09-15 23:59:59+05:30'
ORDER BY e.timestamp ASC;
