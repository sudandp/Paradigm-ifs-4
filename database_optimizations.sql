-- RPC 1: get_today_metrics
CREATE OR REPLACE FUNCTION get_today_metrics(
  p_society_id UUID   DEFAULT NULL,
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
  WHERE  u.status != 'inactive'
    AND  (p_society_id IS NULL OR u.society_id      = p_society_id)
    AND  (p_site_ids   IS NULL OR u.organization_id = ANY(p_site_ids));

  RETURN QUERY
  WITH
  active_staff AS (
    SELECT u.id AS user_id
    FROM   users u
    WHERE  u.status != 'inactive'
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

GRANT EXECUTE ON FUNCTION get_today_metrics(UUID, TEXT[]) TO authenticated;

-- RPC 2: get_attendance_summary
CREATE OR REPLACE FUNCTION get_attendance_summary(
  p_start        DATE,
  p_end          DATE,
  p_society_id   UUID    DEFAULT NULL,
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
  v_shift_start        TIME := '09:30:00'; -- CHANGE THIS to your actual shift start
BEGIN
  SELECT COUNT(*)
  INTO   v_active_staff_count
  FROM   users u
  WHERE  u.role_id IS NOT NULL
    AND  (p_society_id IS NULL OR u.society_id      = p_society_id)
    AND  (p_site_ids   IS NULL OR u.organization_id = ANY(p_site_ids));

  RETURN QUERY
  WITH
  active_staff AS (
    SELECT u.id AS user_id
    FROM   users u
    WHERE  u.role_id IS NOT NULL
      AND  (p_society_id IS NULL OR u.society_id      = p_society_id)
      AND  (p_site_ids   IS NULL OR u.organization_id = ANY(p_site_ids))
  ),
  day_series AS (
    SELECT generate_series(p_start, p_end, '1 day'::INTERVAL)::DATE AS day
  ),
  daily_work AS (
    SELECT
      ae.user_id,
      DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata') AS work_day,
      MIN(ae.timestamp AT TIME ZONE 'Asia/Kolkata') FILTER (WHERE ae.type = 'punch-in')  AS first_in,
      MAX(ae.timestamp AT TIME ZONE 'Asia/Kolkata') FILTER (WHERE ae.type = 'punch-out') AS last_out,
      COALESCE(
        SUM(
          EXTRACT(EPOCH FROM (
            LEAD(ae.timestamp) OVER (
              PARTITION BY ae.user_id, DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata')
              ORDER BY ae.timestamp
            ) - ae.timestamp
          ))
        ) FILTER (WHERE ae.type = 'break-out'),
        0
      ) AS break_seconds
    FROM   attendance_events ae
    JOIN   active_staff        s ON s.user_id = ae.user_id
    WHERE  ae.timestamp >= p_start::TIMESTAMPTZ
      AND  ae.timestamp <  (p_end + 1)::TIMESTAMPTZ
      AND  ae.type IN ('punch-in','punch-out','break-in','break-out')
    GROUP BY ae.user_id, DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata')
  ),
  daily_hours AS (
    SELECT
      dw.user_id,
      dw.work_day,
      dw.first_in,
      GREATEST(
        EXTRACT(EPOCH FROM (
          COALESCE(dw.last_out, 
            CASE WHEN dw.work_day = CURRENT_DATE THEN CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata' 
                 ELSE dw.first_in 
            END
          ) - dw.first_in
        )) - dw.break_seconds,
        0
      ) / 3600.0 AS net_hours
    FROM daily_work dw
    WHERE dw.first_in  IS NOT NULL
  ),
  daily_leave AS (
    SELECT
      ds.day,
      lr.user_id,
      CASE
        WHEN LOWER(lr.leave_type) ILIKE '%work from home%'
          OR LOWER(lr.leave_type) ILIKE 'wfh'
          OR LOWER(lr.leave_type) ILIKE 'w/h'
        THEN 'wfh'
        ELSE 'leave'
      END AS leave_category
    FROM   day_series   ds
    JOIN   leave_requests lr
           ON  ds.day BETWEEN lr.start_date AND lr.end_date
    JOIN   active_staff   s ON s.user_id = lr.user_id
    WHERE  lr.status IN (
             'approved','approved_by_reporting',
             'approved_by_admin','correction_made'
           )
  )
  SELECT
    ds.day,
    COUNT(DISTINCT dh.user_id)::INT,
    COUNT(DISTINCT dl_wfh.user_id)::INT,
    COUNT(DISTINCT dl_leave.user_id)::INT,
    GREATEST(
      v_active_staff_count
        - COUNT(DISTINCT dh.user_id)
        - COUNT(DISTINCT dl_leave.user_id),
      0
    )::INT,
    ROUND(COALESCE(AVG(dh.net_hours) FILTER (WHERE dh.user_id IS NOT NULL), 0), 1),
    COUNT(DISTINCT dh.user_id) FILTER (WHERE dh.first_in::TIME > v_shift_start)::INT,
    v_active_staff_count::INT
  FROM      day_series                               ds
  LEFT JOIN daily_hours                              dh    ON dh.work_day       = ds.day
  LEFT JOIN daily_leave dl_wfh  ON dl_wfh.day  = ds.day AND dl_wfh.leave_category  = 'wfh'
  LEFT JOIN daily_leave dl_leave ON dl_leave.day = ds.day AND dl_leave.leave_category = 'leave'
  GROUP BY ds.day
  ORDER BY ds.day ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_attendance_summary(DATE, DATE, UUID, TEXT[]) TO authenticated;

-- RPC 3: get_top_performers
CREATE OR REPLACE FUNCTION get_top_performers(
  p_start      DATE,
  p_end        DATE,
  p_society_id UUID    DEFAULT NULL,
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
    WHERE  u.status != 'inactive'
      AND  (p_society_id IS NULL OR u.society_id      = p_society_id)
      AND  (p_site_ids   IS NULL OR u.organization_id = ANY(p_site_ids))
  ),
  daily_work AS (
    SELECT
      ae.user_id,
      DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata') AS work_day,
      MIN(ae.timestamp AT TIME ZONE 'Asia/Kolkata') FILTER (WHERE ae.type = 'punch-in')  AS first_in,
      MAX(ae.timestamp AT TIME ZONE 'Asia/Kolkata') FILTER (WHERE ae.type = 'punch-out') AS last_out,
      COALESCE(
        SUM(
          EXTRACT(EPOCH FROM (
            LEAD(ae.timestamp) OVER (
              PARTITION BY ae.user_id, DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata')
              ORDER BY ae.timestamp
            ) - ae.timestamp
          ))
        ) FILTER (WHERE ae.type = 'break-out'),
        0
      ) AS break_seconds
    FROM   attendance_events ae
    JOIN   active_staff s ON s.user_id = ae.user_id
    WHERE  ae.timestamp >= p_start::TIMESTAMPTZ
      AND  ae.timestamp <  (p_end + 1)::TIMESTAMPTZ
      AND  ae.type IN ('punch-in','punch-out','break-in','break-out')
    GROUP BY ae.user_id, DATE(ae.timestamp AT TIME ZONE 'Asia/Kolkata')
  ),
  user_totals AS (
    SELECT
      dw.user_id,
      ROUND(SUM(
        GREATEST(
          EXTRACT(EPOCH FROM (dw.last_out - dw.first_in)) - dw.break_seconds, 0
        ) / 3600.0
      ), 1) AS total_hours,
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
    COALESCE(ut.total_hours,  0) AS total_hours,
    COALESCE(ut.days_present, 0) AS days_present
  FROM   active_staff s
  LEFT JOIN user_totals ut ON ut.user_id = s.user_id
  ORDER BY total_hours DESC
  LIMIT  p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_top_performers(DATE, DATE, UUID, TEXT[], INT) TO authenticated;
