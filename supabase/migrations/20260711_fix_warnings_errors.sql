-- ============================================================================
-- FIX: PostgREST Warnings & Errors  (Jul 11, 2026)
-- ============================================================================
-- Root Cause 1 (14,575 WARNINGS):
--   PostgreSQL collation version mismatch.
--   DB was created with ICU collation version 153.120 but OS now provides
--   153.121. PostgREST logs a WARNING on every connection until resolved.
--
-- Root Cause 2 (6,485 ERRORS):
--   "Warp server error: Thread killed by timeout manager"
--   Heavy queries (attendance_events bulk fetch for all users over a date
--   range, leave_requests with OR filters) are hitting the PostgREST
--   server-side timeout (~3s default). Adding targeted indexes eliminates
--   the slow sequential scans that cause the timeouts.
-- ============================================================================


-- =======================================================================
-- FIX 1: Collation Version Mismatch
--   Refreshes stored collation version to match current OS version.
--   Stops the WARNING cascade in PostgREST logs immediately.
-- =======================================================================
ALTER DATABASE postgres REFRESH COLLATION VERSION;


-- =======================================================================
-- FIX 2: Add Missing Performance Indexes
--   Eliminates sequential scans that drive Warp timeout errors.
-- =======================================================================

-- #1 BIGGEST OFFENDER: attendance_events
-- getAttendanceEventsForUsers: .in('user_id', userIds).gte('timestamp').lte('timestamp')
-- Without this index every monthly report does a full table scan.
CREATE INDEX IF NOT EXISTS idx_att_events_user_timestamp
  ON public.attendance_events (user_id, timestamp DESC);

-- attendance_events: BRIN index for RPC get_attendance_dashboard_data date-range scan
CREATE INDEX IF NOT EXISTS idx_att_events_timestamp_brin
  ON public.attendance_events USING BRIN (timestamp);

-- #2 route_history: getRoutePointsForUsers - same pattern as attendance_events
CREATE INDEX IF NOT EXISTS idx_route_history_user_timestamp
  ON public.route_history (user_id, timestamp DESC);

-- #3 leave_requests: getLeaveRequests with forApproverId OR filter
CREATE INDEX IF NOT EXISTS idx_leave_requests_approver_status
  ON public.leave_requests (current_approver_id, status);

-- leave_requests: date range overlap (.lte start_date, .gte end_date)
CREATE INDEX IF NOT EXISTS idx_leave_requests_date_range
  ON public.leave_requests (start_date, end_date);

-- leave_requests: user_id + date combo for the monthly report fetch
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_dates2
  ON public.leave_requests (user_id, start_date, end_date);

-- #4 users: OR filter on reporting_manager_2_id / reporting_manager_3_id
CREATE INDEX IF NOT EXISTS idx_users_rm2_rm3
  ON public.users (reporting_manager_2_id, reporting_manager_3_id);

-- #5 attendance_month_snapshots: getMonthSnapshotsBulk
-- .in('employee_id', ids).eq('year', y).eq('month', m)
CREATE INDEX IF NOT EXISTS idx_att_month_snapshots_lookup
  ON public.attendance_month_snapshots (employee_id, year, month);

-- #6 notifications: notification panel query
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications (user_id, is_read, created_at DESC);


-- =======================================================================
-- FIX 3: Update planner stats so new indexes are used immediately
-- =======================================================================
ANALYZE public.attendance_events;
ANALYZE public.route_history;
ANALYZE public.leave_requests;
ANALYZE public.users;
ANALYZE public.attendance_month_snapshots;
ANALYZE public.notifications;
