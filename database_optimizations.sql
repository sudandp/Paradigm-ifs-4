-- RPC 1: get_today_metrics
DROP FUNCTION IF EXISTS get_today_metrics(UUID, TEXT[]);
DROP FUNCTION IF EXISTS get_today_metrics(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION get_today_metrics(
  p_society_id TEXT   DEFAULT NULL,
  p_site_ids   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  present_today       INT,
  absent_today        INT,
  wfh_today           INT,
  on_leave_today      INT,
  late_arrivals_today INT,
  pending_leaves      INT,
  approved_leaves     INT,
  total_active_staff  INT
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_today        DATE   := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
  v_shift_start  TIME   := '09:30:00'; -- CHANGE THIS to your actual shift start
  v_active_count INT;
BEGIN
  SELECT COUNT(*)
  INTO   v_active_count
  FROM   users u
  WHERE  u.role_id IS NOT NULL AND u.role_id <> ''
    AND  (p_society_id IS NULL OR u.society_id      = p_society_id)
    AND  (p_site_ids   IS NULL OR u.organization_id = ANY(p_site_ids));

  RETURN QUERY
  WITH
  active_staff AS (
    SELECT u.id AS user_id
    FROM   users u
    WHERE  u.role_id IS NOT NULL AND u.role_id <> ''
      AND  (p_society_id IS NULL OR u.society_id      = p_society_id)
      AND  (p_site_ids   IS NULL OR u.organization_id = ANY(p_site_ids))
  ),
  today_punches AS (
    SELECT
      ae.user_id,
      MIN(ae.timestamp AT TIME ZONE 'Asia/Kolkata') FILTER (WHERE ae.type = 'punch-in') AS first_in
    FROM   attendance_events ae
    JOIN   active_staff s ON s.user_id = ae.user_id
    WHERE  DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata') = v_today
      AND  ae.type = 'punch-in'
    GROUP BY ae.user_id
  ),
  today_leaves AS (
    SELECT
      lr.user_id,
      lr.status,
      CASE
        WHEN LOWER(lr.leave_type) ILIKE '%work from home%'
          OR LOWER(lr.leave_type) ILIKE 'wfh'
          OR LOWER(lr.leave_type) ILIKE 'w/h'
        THEN 'wfh'
        ELSE 'leave'
      END AS leave_category
    FROM   leave_requests lr
    JOIN   active_staff    s ON s.user_id = lr.user_id
    WHERE  v_today BETWEEN lr.start_date AND lr.end_date
  )
  SELECT
    (SELECT COUNT(DISTINCT user_id) FROM today_punches)::INT,
    GREATEST(
      v_active_count
        - (SELECT COUNT(DISTINCT user_id) FROM today_punches)
        - (SELECT COUNT(DISTINCT user_id) FROM today_leaves
           WHERE status IN ('approved','approved_by_reporting','approved_by_admin','correction_made')
             AND leave_category = 'leave'),
      0
    )::INT,
    (SELECT COUNT(DISTINCT user_id) FROM today_leaves
     WHERE  status IN ('approved','approved_by_reporting','approved_by_admin','correction_made')
       AND  leave_category = 'wfh')::INT,
    (SELECT COUNT(DISTINCT user_id) FROM today_leaves
     WHERE  status IN ('approved','approved_by_reporting','approved_by_admin','correction_made')
       AND  leave_category = 'leave')::INT,
    (SELECT COUNT(*) FROM today_punches WHERE first_in::TIME > v_shift_start)::INT,
    (SELECT COUNT(DISTINCT user_id) FROM today_leaves WHERE status = 'pending')::INT,
    (SELECT COUNT(DISTINCT user_id) FROM today_leaves
     WHERE  status IN ('approved','approved_by_reporting','approved_by_admin','correction_made'))::INT,
    v_active_count::INT;
END;
$$;

GRANT EXECUTE ON FUNCTION get_today_metrics(TEXT, TEXT[]) TO authenticated;


-- RPC 2: get_attendance_summary
DROP FUNCTION IF EXISTS get_attendance_summary(DATE, DATE, UUID, TEXT[]);
DROP FUNCTION IF EXISTS get_attendance_summary(DATE, DATE, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION get_attendance_summary(
  p_start        DATE,
  p_end          DATE,
  p_society_id   TEXT    DEFAULT NULL,
  p_site_ids     TEXT[]  DEFAULT NULL
)
RETURNS TABLE (
  day                DATE,
  present_count      INT,
  wfh_count          INT,
  on_leave_count     INT,
  absent_count       INT,
  avg_working_hours  NUMERIC(4,1),
  late_arrivals      INT,
  total_active_staff INT
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_active_staff_count INT;
  v_shift_start        TIME := '09:30:00';
BEGIN
  SELECT COUNT(*) INTO v_active_staff_count
  FROM   users u
  WHERE  u.role_id IS NOT NULL
    AND  u.role_id <> ''
    AND  (p_society_id IS NULL OR u.society_id      = p_society_id)
    AND  (p_site_ids   IS NULL OR u.organization_id = ANY(p_site_ids));

  RETURN QUERY
  WITH
  active_staff AS (
    SELECT u.id AS staff_id
    FROM   users u
    WHERE  u.role_id IS NOT NULL
      AND  u.role_id <> ''
      AND  (p_society_id IS NULL OR u.society_id      = p_society_id)
      AND  (p_site_ids   IS NULL OR u.organization_id = ANY(p_site_ids))
  ),
  day_series AS (
    SELECT generate_series(p_start, p_end, '1 day'::INTERVAL)::DATE AS ds_day
  ),
  daily_work AS (
    SELECT
      ae.user_id                                                        AS dw_uid,
      DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata')                   AS work_day,
      MIN(ae.timestamp AT TIME ZONE 'Asia/Kolkata')
        FILTER (WHERE ae.type = 'punch-in')                            AS first_in,
      MAX(ae.timestamp AT TIME ZONE 'Asia/Kolkata')
        FILTER (WHERE ae.type = 'punch-out')                           AS last_out,
      CASE
        WHEN MIN(ae.timestamp AT TIME ZONE 'Asia/Kolkata') FILTER (WHERE ae.type = 'punch-in') IS NOT NULL
             AND MAX(ae.timestamp AT TIME ZONE 'Asia/Kolkata') FILTER (WHERE ae.type = 'punch-out') IS NOT NULL
        THEN GREATEST(
          EXTRACT(EPOCH FROM (MAX(ae.timestamp AT TIME ZONE 'Asia/Kolkata') FILTER (WHERE ae.type = 'punch-out') - MIN(ae.timestamp AT TIME ZONE 'Asia/Kolkata') FILTER (WHERE ae.type = 'punch-in'))) / 3600.0, 0
        )
        ELSE NULL
      END AS net_hours
    FROM   attendance_events ae
    JOIN   active_staff s ON s.staff_id = ae.user_id
    WHERE  ae.timestamp >= p_start::TIMESTAMPTZ
      AND  ae.timestamp <  (p_end + 1)::TIMESTAMPTZ
      AND  ae.type IN ('punch-in','punch-out')
    GROUP BY ae.user_id, DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata')
  ),
  daily_leave AS (
    SELECT
      ds.ds_day                                                         AS dl_day,
      lr.user_id                                                        AS dl_uid,
      CASE
        WHEN lr.leave_type ILIKE '%work from home%'
          OR lr.leave_type ILIKE 'wfh'
          OR lr.leave_type ILIKE 'w/h'
        THEN 'wfh'
        ELSE 'leave'
      END                                                               AS leave_category
    FROM   day_series   ds
    JOIN   leave_requests lr
           ON  ds.ds_day BETWEEN lr.start_date AND lr.end_date
    JOIN   active_staff   s ON s.staff_id = lr.user_id
    WHERE  lr.status IN ('approved','approved_by_reporting',
                         'approved_by_admin','correction_made')
  )
  SELECT
    ds.ds_day,
    COUNT(DISTINCT dw.dw_uid) FILTER (WHERE dw.first_in IS NOT NULL)::INT,
    COUNT(DISTINCT dl_wfh.dl_uid)::INT,
    COUNT(DISTINCT dl_leave.dl_uid)::INT,
    GREATEST(
      v_active_staff_count
        - COUNT(DISTINCT dw.dw_uid) FILTER (WHERE dw.first_in IS NOT NULL)
        - COUNT(DISTINCT dl_leave.dl_uid),
      0
    )::INT,
    ROUND(COALESCE(AVG(dw.net_hours), 0)::NUMERIC, 1),
    COUNT(DISTINCT dw.dw_uid)
      FILTER (WHERE dw.first_in IS NOT NULL AND dw.first_in::TIME > v_shift_start)::INT,
    v_active_staff_count::INT
  FROM      day_series                                    ds
  LEFT JOIN daily_work                                    dw
            ON  dw.work_day        = ds.ds_day
  LEFT JOIN daily_leave                                   dl_wfh
            ON  dl_wfh.dl_day      = ds.ds_day
            AND dl_wfh.leave_category  = 'wfh'
  LEFT JOIN daily_leave                                   dl_leave
            ON  dl_leave.dl_day    = ds.ds_day
            AND dl_leave.leave_category = 'leave'
  GROUP BY  ds.ds_day
  ORDER BY  ds.ds_day ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_attendance_summary(DATE, DATE, TEXT, TEXT[]) TO authenticated;


-- RPC 3: get_top_performers
DROP FUNCTION IF EXISTS get_top_performers(DATE, DATE, UUID, TEXT[], INT);
DROP FUNCTION IF EXISTS get_top_performers(DATE, DATE, TEXT, TEXT[], INT);

CREATE OR REPLACE FUNCTION get_top_performers(
  p_start      DATE,
  p_end        DATE,
  p_society_id TEXT    DEFAULT NULL,
  p_site_ids   TEXT[]  DEFAULT NULL,
  p_limit      INT     DEFAULT 4
)
RETURNS TABLE (
  user_id      UUID,
  name         TEXT,
  role_name    TEXT,
  total_hours  NUMERIC(6,1),
  days_present INT
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH
  active_staff AS (
    SELECT u.id AS user_id, u.name, r.display_name AS role_name
    FROM   users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE  u.role_id IS NOT NULL AND u.role_id <> ''
      AND  (p_society_id IS NULL OR u.society_id      = p_society_id)
      AND  (p_site_ids   IS NULL OR u.organization_id = ANY(p_site_ids))
  ),
  events_with_lead AS (
    SELECT
      ae.user_id,
      DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata') AS work_day,
      ae.type,
      ae.timestamp AT TIME ZONE 'Asia/Kolkata' AS event_time,
      LEAD(ae.timestamp AT TIME ZONE 'Asia/Kolkata') OVER (
        PARTITION BY ae.user_id, DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata')
        ORDER BY ae.timestamp
      ) AS next_event_time
    FROM   attendance_events ae
    JOIN   active_staff        s ON s.user_id = ae.user_id
    WHERE  ae.timestamp >= p_start::TIMESTAMPTZ
      AND  ae.timestamp <  (p_end + 1)::TIMESTAMPTZ
      AND  ae.type IN ('punch-in','punch-out','break-in','break-out')
  ),
  daily_work AS (
    SELECT
      el.user_id,
      el.work_day,
      MIN(el.event_time) FILTER (WHERE el.type = 'punch-in') AS first_in,
      MAX(el.event_time) FILTER (WHERE el.type = 'punch-out') AS last_out,
      COALESCE(
        SUM(
          EXTRACT(EPOCH FROM (el.next_event_time - el.event_time))
        ) FILTER (WHERE el.type = 'break-out'),
        0
      ) AS break_seconds
    FROM   events_with_lead el
    GROUP BY el.user_id, el.work_day
  ),
  user_totals AS (
    SELECT
      dw.user_id,
      ROUND(SUM(
        COALESCE(
          GREATEST(
            EXTRACT(EPOCH FROM (dw.last_out - dw.first_in)) - dw.break_seconds, 0
          ) / 3600.0,
          0
        )
      )::NUMERIC, 1) AS total_hours,
      COUNT(*) FILTER (
        WHERE dw.first_in IS NOT NULL AND dw.last_out IS NOT NULL
      )::INT AS days_present
    FROM daily_work dw
    WHERE dw.first_in IS NOT NULL AND dw.last_out IS NOT NULL
    GROUP BY dw.user_id
  )
  SELECT
    s.user_id,
    s.name,
    s.role_name,
    COALESCE(ut.total_hours,  0)::NUMERIC(6,1) AS total_hours,
    COALESCE(ut.days_present, 0)::INT AS days_present
  FROM   active_staff s
  LEFT JOIN user_totals ut ON ut.user_id = s.user_id
  ORDER BY total_hours DESC
  LIMIT  p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_top_performers(DATE, DATE, TEXT, TEXT[], INT) TO authenticated;
