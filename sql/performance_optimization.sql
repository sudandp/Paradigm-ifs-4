-- ================================================================
-- PERFORMANCE OPTIMIZATION: Critical Database Indexes
-- Purpose: Resolves "exhausting multiple resources" errors in Supabase
-- ================================================================

-- 1. ATTENDANCE EVENTS: Most frequent and largest table
-- Critical for report generation and dashboard loading
CREATE INDEX IF NOT EXISTS idx_attendance_events_user_timestamp 
ON public.attendance_events(user_id, timestamp DESC);

-- 2. LEAVE REQUESTS: Speeds up holiday and status resolution
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_dates 
ON public.leave_requests(user_id, start_date, end_date);

-- 3. USER HOLIDAYS: Optimization for pool holiday checks
CREATE INDEX IF NOT EXISTS idx_user_holidays_user_date 
ON public.user_holidays(user_id, holiday_date);

-- 4. USERS: Optimization for filtering by organization/society in reports
CREATE INDEX IF NOT EXISTS idx_users_organization_society 
ON public.users(organization_id, society_id);

-- 5. NOTIFICATIONS: Speeds up dashboard unread counts
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON public.notifications(user_id, is_read) 
WHERE is_read = false;

ANALYZE public.attendance_events;
ANALYZE public.leave_requests;
ANALYZE public.user_holidays;
