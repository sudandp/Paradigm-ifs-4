-- Drop duplicate indexes (identified by pg_index audit and Supabase database linter)
DROP INDEX IF EXISTS public.idx_leave_balance_lookup;
DROP INDEX IF EXISTS public.idx_monthly_summary_employee_period;
DROP INDEX IF EXISTS public.attendance_events_work_type_idx;
DROP INDEX IF EXISTS public.idx_kiosk_devices_location;
DROP INDEX IF EXISTS public.idx_rule_cache_user_id;
DROP INDEX IF EXISTS public.idx_snapshots_employee_month;
DROP INDEX IF EXISTS public.idx_gate_users_user_id;
DROP INDEX IF EXISTS public.idx_gate_users_qr_token;
DROP INDEX IF EXISTS public.idx_holidays_site_date;
DROP INDEX IF EXISTS public.idx_leave_requests_user_dates;
DROP INDEX IF EXISTS public.idx_fcm_tokens_token;

-- Optimize attendance_events summary refresh trigger to only execute on relevant column changes
DROP TRIGGER IF EXISTS tr_refresh_attendance_summary ON public.attendance_events;

CREATE TRIGGER tr_refresh_attendance_summary
  AFTER INSERT OR DELETE OR UPDATE OF user_id, "timestamp", type, work_type, is_manual, location_id, is_ot
  ON public.attendance_events
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_attendance_summary();
