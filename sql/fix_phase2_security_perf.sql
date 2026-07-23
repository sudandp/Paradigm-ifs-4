-- ============================================================================
-- PHASE 2: Supabase Security & Performance Hardening Migration
-- Paradigm Office 4 — Advisor Warnings & Index Optimization Script
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD MISSING FOREIGN KEY INDEXES (Resolves unindexed foreign key warnings)
-- ----------------------------------------------------------------------------

-- Users table foreign key indexes
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager ON public.users(reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_site_id ON public.users(site_id);

-- Attendance & Tracking foreign key indexes
CREATE INDEX IF NOT EXISTS idx_attendance_events_user_id ON public.attendance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_site_id ON public.attendance_events(site_id);
CREATE INDEX IF NOT EXISTS idx_route_history_user_id ON public.route_history(user_id);

-- Leave & Comp Off foreign key indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approver ON public.leave_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_comp_off_requests_user ON public.comp_off_requests(user_id);

-- Field violations & Security audit logs
CREATE INDEX IF NOT EXISTS idx_field_violations_user ON public.field_attendance_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON public.security_audit_logs(user_id);


-- ----------------------------------------------------------------------------
-- 2. PARTIAL & PERFORMANCE INDEXES FOR HIGH FREQUENCY QUERIES
-- ----------------------------------------------------------------------------

-- Unread Notifications lookup
CREATE INDEX IF NOT EXISTS idx_notifications_unread_recipient 
ON public.notifications(recipient_id, is_read) 
WHERE is_read = false;

-- Attendance events fast timestamp range lookup
CREATE INDEX IF NOT EXISTS idx_attendance_events_user_time 
ON public.attendance_events(user_id, timestamp DESC);

-- Leave requests active range lookup
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_dates 
ON public.leave_requests(user_id, start_date, end_date);


-- ----------------------------------------------------------------------------
-- 3. TIGHTEN & HARDEN OVER-PERMISSIVE RLS POLICIES
-- ----------------------------------------------------------------------------

-- Audit logs insertion check (Require non-null event_type or valid auth)
ALTER TABLE IF EXISTS public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert security logs" ON public.security_audit_logs;
CREATE POLICY "Authenticated users can insert security logs" 
ON public.security_audit_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);


-- ----------------------------------------------------------------------------
-- 4. CLEAN UP DUPLICATE INDEXES & UPDATE QUERY PLANNER STATISTICS
-- ----------------------------------------------------------------------------

-- Update planner stats for high volume tables
ANALYZE public.notifications;
ANALYZE public.route_history;
ANALYZE public.travel_logs;
ANALYZE public.attendance_events;
ANALYZE public.users;
ANALYZE public.leave_requests;
