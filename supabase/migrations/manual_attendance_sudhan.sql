-- Manual Attendance Adjustments for Sudhan M
-- This script adds sick leave and work-from-home attendance records

-- First, find Sudhan M's user ID
-- SELECT id, name FROM public.users WHERE name ILIKE '%sudhan%';
-- Let's assume the user_id is found from the above query

-- Replace 'USER_ID_HERE' with actual user ID from the query above

-- ============================================
-- 1. RED BOX: Add Sick Leave for Dec 5-19, 2025 (15 days)
-- ============================================

-- Insert sick leave request for Dec 5-19, 2025
INSERT INTO public.leave_requests (
    user_id,
    leave_type,
    start_date,
    end_date,
    reason,
    status,
    day_option,
    approval_history,
    current_approver_id
) VALUES (
    'USER_ID_HERE',  -- Replace with actual user_id
    'Sick',
    '2025-12-05',
    '2025-12-19',
    'Manual adjustment - Sick Leave',
    'approved',  -- Automatically approve
    NULL,  -- Full day leave
    '[]'::jsonb,  -- Empty approval history
    NULL
);

-- ============================================
-- 2. GREEN BOX: Add Work From Home attendance for Dec 23-31, 2025 (9 days)
-- ============================================

-- Dec 23-31, 2025 - Work From Home (8 hours per day)
-- Generate attendance for each day
INSERT INTO public.attendance_events (user_id, timestamp, type, location_name)
VALUES 
    -- Dec 23
    ('USER_ID_HERE', '2025-12-23 09:00:00+05:30', 'check-in', 'Work From Home'),
    ('USER_ID_HERE', '2025-12-23 17:00:00+05:30', 'check-out', 'Work From Home'),
    -- Dec 24
    ('USER_ID_HERE', '2025-12-24 09:00:00+05:30', 'check-in', 'Work From Home'),
    ('USER_ID_HERE', '2025-12-24 17:00:00+05:30', 'check-out', 'Work From Home'),
    -- Dec 25
    ('USER_ID_HERE', '2025-12-25 09:00:00+05:30', 'check-in', 'Work From Home'),
    ('USER_ID_HERE', '2025-12-25 17:00:00+05:30', 'check-out', 'Work From Home'),
    -- Dec 26
    ('USER_ID_HERE', '2025-12-26 09:00:00+05:30', 'check-in', 'Work From Home'),
    ('USER_ID_HERE', '2025-12-26 17:00:00+05:30', 'check-out', 'Work From Home'),
    -- Dec 27
    ('USER_ID_HERE', '2025-12-27 09:00:00+05:30', 'check-in', 'Work From Home'),
    ('USER_ID_HERE', '2025-12-27 17:00:00+05:30', 'check-out', 'Work From Home'),
    -- Dec 28
    ('USER_ID_HERE', '2025-12-28 09:00:00+05:30', 'check-in', 'Work From Home'),
    ('USER_ID_HERE', '2025-12-28 17:00:00+05:30', 'check-out', 'Work From Home'),
    -- Dec 29
    ('USER_ID_HERE', '2025-12-29 09:00:00+05:30', 'check-in', 'Work From Home'),
    ('USER_ID_HERE', '2025-12-29 17:00:00+05:30', 'check-out', 'Work From Home'),
    -- Dec 30
    ('USER_ID_HERE', '2025-12-30 09:00:00+05:30', 'check-in', 'Work From Home'),
    ('USER_ID_HERE', '2025-12-30 17:00:00+05:30', 'check-out', 'Work From Home'),
    -- Dec 31
    ('USER_ID_HERE', '2025-12-31 09:00:00+05:30', 'check-in', 'Work From Home'),
    ('USER_ID_HERE', '2025-12-31 17:00:00+05:30', 'check-out', 'Work From Home');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check leave requests
-- SELECT * FROM public.leave_requests 
-- WHERE user_id = 'USER_ID_HERE' 
-- AND start_date >= '2025-12-01' 
-- ORDER BY start_date;

-- Check attendance events
-- SELECT id, timestamp::date as date, type, location_name 
-- FROM public.attendance_events 
-- WHERE user_id = 'USER_ID_HERE' 
-- AND timestamp >= '2025-12-01' 
-- ORDER BY timestamp;
