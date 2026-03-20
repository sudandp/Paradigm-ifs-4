# Manual Attendance Update Guide for Sudhan M

## Instructions

Follow these steps to manually update attendance data for Sudhan M:

### Quick Solution - Run This Single Query! ✅

**IMPORTANT:** Make sure to delete any existing incorrect leave entries first,
then run this corrected query:

```sql
DO $$
DECLARE
    sudhan_id UUID;
BEGIN
    SELECT id INTO sudhan_id FROM public.users WHERE name ILIKE '%sudhan%' LIMIT 1;
    
    -- Delete any existing leave requests for Dec 2025 for this user (cleanup)
    DELETE FROM public.leave_requests 
    WHERE user_id = sudhan_id 
      AND start_date >= '2025-12-01' 
      AND end_date <= '2025-12-31';
    
    -- Delete any existing attendance for Dec 23-31 (cleanup)
    DELETE FROM public.attendance_events
    WHERE user_id = sudhan_id
      AND timestamp >= '2025-12-23 00:00:00+05:30'
      AND timestamp <= '2025-12-31 23:59:59+05:30';
    
    -- Add sick leave for Dec 5-19, 2025 (15 days)
    INSERT INTO public.leave_requests (user_id, leave_type, start_date, end_date, reason, status, approval_history)
    VALUES (sudhan_id, 'Sick', '2025-12-05', '2025-12-19', 'Manual adjustment - Sick Leave', 'approved', '[]'::jsonb);
    
    -- Add work from home attendance for Dec 23-31, 2025 (9 days)
    INSERT INTO public.attendance_events (user_id, timestamp, type, location_name)
    VALUES 
        (sudhan_id, '2025-12-23 09:00:00+05:30', 'check-in', 'Work From Home'),
        (sudhan_id, '2025-12-23 17:00:00+05:30', 'check-out', 'Work From Home'),
        (sudhan_id, '2025-12-24 09:00:00+05:30', 'check-in', 'Work From Home'),
        (sudhan_id, '2025-12-24 17:00:00+05:30', 'check-out', 'Work From Home'),
        (sudhan_id, '2025-12-25 09:00:00+05:30', 'check-in', 'Work From Home'),
        (sudhan_id, '2025-12-25 17:00:00+05:30', 'check-out', 'Work From Home'),
        (sudhan_id, '2025-12-26 09:00:00+05:30', 'check-in', 'Work From Home'),
        (sudhan_id, '2025-12-26 17:00:00+05:30', 'check-out', 'Work From Home'),
        (sudhan_id, '2025-12-27 09:00:00+05:30', 'check-in', 'Work From Home'),
        (sudhan_id, '2025-12-27 17:00:00+05:30', 'check-out', 'Work From Home'),
        (sudhan_id, '2025-12-28 09:00:00+05:30', 'check-in', 'Work From Home'),
        (sudhan_id, '2025-12-28 17:00:00+05:30', 'check-out', 'Work From Home'),
        (sudhan_id, '2025-12-29 09:00:00+05:30', 'check-in', 'Work From Home'),
        (sudhan_id, '2025-12-29 17:00:00+05:30', 'check-out', 'Work From Home'),
        (sudhan_id, '2025-12-30 09:00:00+05:30', 'check-in', 'Work From Home'),
        (sudhan_id, '2025-12-30 17:00:00+05:30', 'check-out', 'Work From Home'),
        (sudhan_id, '2025-12-31 09:00:00+05:30', 'check-in', 'Work From Home'),
        (sudhan_id, '2025-12-31 17:00:00+05:30', 'check-out', 'Work From Home');
        
    RAISE NOTICE 'Data updated successfully for user ID: %', sudhan_id;
END $$;
```

**Result After Running:**

- ✅ Dec 5-19: Will show **`S/L`** (Sick Leave) - 15 days
- ✅ Dec 23-31: Will show **`W/H`** (Work From Home) - 9 days
- ✅ All other dates remain unchanged

### After Running the Query

1. Refresh your browser
2. Navigate to Attendance Dashboard
3. Generate the Monthly Report for December 2025
4. Verify Sudhan M shows S/L for Dec 5-19 and W/H for Dec 23-31
