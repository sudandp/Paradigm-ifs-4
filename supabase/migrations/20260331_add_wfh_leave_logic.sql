-- Migration: Add WFH Leave Logic to Attendance RPCs
-- Date: 2026-03-31
-- Description: Updates get_attendance_dashboard_data and get_monthly_muster_data to treat 'WFH' leave type as 'Present'.

CREATE OR REPLACE FUNCTION public.get_attendance_dashboard_data(start_date_iso text, end_date_iso text, current_date_iso text)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    start_dt date := start_date_iso::date;
    end_dt date := end_date_iso::date;
    current_dt date := current_date_iso::date;
BEGIN
    WITH user_date_matrix AS (
        SELECT u.id as user_id, u.role_id, d.day::date
        FROM public.users u CROSS JOIN generate_series(start_dt, end_dt, '1 day'::interval) as d(day)
    ),
    daily_events AS (
        SELECT user_id, "timestamp"::date as event_date, MIN(CASE WHEN type IN ('check-in', 'punch-in', 'Site In') THEN "timestamp" END) as first_check_in, MAX(CASE WHEN type IN ('check-out', 'punch-out', 'Site Out') THEN "timestamp" END) as last_check_out
        FROM public.attendance_events
        WHERE "timestamp"::date BETWEEN start_dt AND end_dt
        GROUP BY user_id, event_date
    ),
    daily_status AS (
        SELECT
            udm.user_id, udm.day, (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0) as work_hours,
            CASE
                WHEN lr.id IS NOT NULL THEN 
                    CASE 
                        WHEN lr.leave_type = 'WFH' THEN 'Present'
                        WHEN lr.day_option = 'half' THEN 'On Leave (Half)' 
                        ELSE 'On Leave (Full)' 
                    END
                WHEN de.first_check_in IS NOT NULL THEN
                    CASE
                        WHEN de.last_check_out IS NULL THEN CASE WHEN udm.day < current_dt THEN 'Absent' ELSE 'Incomplete' END
                        WHEN (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0) >= (s.attendance_settings->(CASE WHEN udm.role_id IN ('admin', 'hr', 'finance', 'finance_ops') THEN 'office' ELSE 'field' END)->>'minimumHoursFullDay')::numeric THEN 'Present'
                        WHEN (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0) >= (s.attendance_settings->(CASE WHEN udm.role_id IN ('admin', 'hr', 'finance', 'finance_ops') THEN 'office' ELSE 'field' END)->>'minimumHoursHalfDay')::numeric THEN 'Half Day'
                        ELSE 'Absent'
                    END
                WHEN h.id IS NOT NULL THEN 'Holiday'
                WHEN EXTRACT(DOW FROM udm.day) IN (0, 6) THEN 'Weekend'
                ELSE 'Absent'
            END as status
        FROM user_date_matrix udm
        LEFT JOIN daily_events de ON udm.user_id = de.user_id AND udm.day = de.event_date
        LEFT JOIN public.leave_requests lr ON udm.user_id = lr.user_id AND lr.status = 'approved' AND udm.day BETWEEN lr.start_date AND lr.end_date
        LEFT JOIN public.holidays h ON udm.day = h.date AND h.type = CASE WHEN udm.role_id IN ('admin', 'hr', 'finance', 'finance_ops') THEN 'office' ELSE 'field' END
        CROSS JOIN public.settings s
        WHERE s.id = 'singleton'
    ),
    aggregated_trends AS (
        SELECT day, count(*) FILTER (WHERE status IN ('Present', 'Half Day', 'Incomplete')) as present_count, count(*) FILTER (WHERE status = 'Absent') as absent_count, avg(work_hours) FILTER (WHERE work_hours IS NOT NULL AND status IN ('Present', 'Half Day')) as avg_hours
        FROM daily_status GROUP BY day ORDER BY day
    )
    SELECT jsonb_build_object(
            'totalEmployees', (SELECT count(*) FROM public.users),
            'presentToday', (SELECT count(*) FROM daily_status WHERE day = current_dt AND status IN ('Present', 'Half Day', 'Incomplete')),
            'absentToday', (SELECT count(*) FROM daily_status WHERE day = current_dt AND status = 'Absent'),
            'onLeaveToday', (SELECT count(*) FROM daily_status WHERE day = current_dt AND status LIKE 'On Leave%'),
            'attendanceTrend', (SELECT jsonb_build_object('labels', jsonb_agg(to_char(day, 'Dy dd')), 'present', jsonb_agg(present_count), 'absent', jsonb_agg(absent_count)) FROM aggregated_trends),
            'productivityTrend', (SELECT jsonb_build_object('labels', jsonb_agg(to_char(day, 'Dy dd')), 'hours', jsonb_agg(coalesce(round(avg_hours::numeric, 2), 0))) FROM aggregated_trends)
        )
    INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_monthly_muster_data(start_date_iso text, end_date_iso text, user_ids_array uuid[])
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    start_dt date := start_date_iso::date;
    end_dt date := end_date_iso::date;
BEGIN
    WITH user_date_matrix AS (
        SELECT u.id as user_id, u.name as user_name, u.role_id, d.day::date
        FROM public.users u 
        CROSS JOIN generate_series(start_dt, end_dt, '1 day'::interval) as d(day)
        WHERE u.id = ANY(user_ids_array)
    ),
    daily_events AS (
        SELECT user_id, "timestamp"::date as event_date, MIN(CASE WHEN type IN ('check-in', 'punch-in', 'Site In') THEN "timestamp" END) as first_check_in, MAX(CASE WHEN type IN ('check-out', 'punch-out', 'Site Out') THEN "timestamp" END) as last_check_out
        FROM public.attendance_events
        WHERE "timestamp"::date BETWEEN start_dt AND end_dt AND user_id = ANY(user_ids_array)
        GROUP BY user_id, event_date
    ),
    daily_status AS (
        SELECT
            udm.user_id, udm.user_name, udm.day,
            CASE
                WHEN lr.id IS NOT NULL THEN 
                    CASE 
                        WHEN lr.leave_type = 'WFH' THEN 'P'
                        WHEN lr.day_option = 'half' THEN 'HL' 
                        ELSE 'L' 
                    END
                WHEN h.id IS NOT NULL THEN 'H'
                WHEN EXTRACT(DOW FROM udm.day) IN (0, 6) THEN 'WO'
                WHEN de.first_check_in IS NOT NULL THEN
                    CASE
                        WHEN de.last_check_out IS NULL AND udm.day = end_dt THEN 'P'
                        WHEN de.last_check_out IS NULL AND udm.day < end_dt THEN 'A'
                        WHEN (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0) >= (s.attendance_settings->(CASE WHEN udm.role_id IN ('admin', 'hr', 'finance', 'finance_ops') THEN 'office' ELSE 'field' END)->>'minimumHoursFullDay')::numeric THEN 'P'
                        WHEN (EXTRACT(EPOCH FROM (de.last_check_out - de.first_check_in)) / 3600.0) >= (s.attendance_settings->(CASE WHEN udm.role_id IN ('admin', 'hr', 'finance', 'finance_ops') THEN 'office' ELSE 'field' END)->>'minimumHoursHalfDay')::numeric THEN 'HD'
                        ELSE 'SH'
                    END
                ELSE 'A'
            END as status_code
        FROM user_date_matrix udm
        LEFT JOIN daily_events de ON udm.user_id = de.user_id AND udm.day = de.event_date
        LEFT JOIN public.leave_requests lr ON udm.user_id = lr.user_id AND lr.status = 'approved' AND udm.day BETWEEN lr.start_date AND lr.end_date
        LEFT JOIN public.holidays h ON udm.day = h.date AND h.type = CASE WHEN udm.role_id IN ('admin', 'hr', 'finance', 'finance_ops') THEN 'office' ELSE 'field' END
        CROSS JOIN public.settings s
        WHERE s.id = 'singleton'
    ),
    user_daily_statuses AS (
        SELECT
            user_id, user_name,
            jsonb_agg(jsonb_build_object('date', to_char(day, 'YYYY-MM-DD'), 'status', status_code) ORDER BY day) as daily_statuses
        FROM daily_status
        GROUP BY user_id, user_name
    )
    SELECT jsonb_agg(jsonb_build_object('userId', user_id, 'userName', user_name, 'dailyStatuses', daily_statuses))
    INTO result
    FROM user_daily_statuses;

    RETURN result;
END;
$$ LANGUAGE plpgsql SET search_path = public;
