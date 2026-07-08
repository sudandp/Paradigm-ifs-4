import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
  const sql = `
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
  staff_days AS (
    SELECT s.staff_id, ds.ds_day
    FROM active_staff s
    CROSS JOIN day_series ds
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
  ),
  daily_holiday AS (
    SELECT
      ds.ds_day                                                         AS dh_day,
      uh.user_id                                                        AS dh_uid
    FROM day_series ds
    JOIN user_holidays uh ON DATE(uh.holiday_date) = ds.ds_day
    JOIN active_staff s ON s.staff_id = uh.user_id
  ),
  staff_day_status AS (
    SELECT
      sd.ds_day,
      sd.staff_id,
      dw.first_in IS NOT NULL AS has_activity,
      dl_wfh.dl_uid IS NOT NULL AS has_wfh,
      dl_leave.dl_uid IS NOT NULL AS has_leave,
      (dh.dh_uid IS NOT NULL OR EXTRACT(DOW FROM sd.ds_day) = 0) AS is_holiday_or_weekend
    FROM staff_days sd
    LEFT JOIN daily_work dw ON dw.dw_uid = sd.staff_id AND dw.work_day = sd.ds_day
    LEFT JOIN daily_leave dl_wfh ON dl_wfh.dl_uid = sd.staff_id AND dl_wfh.dl_day = sd.ds_day AND dl_wfh.leave_category = 'wfh'
    LEFT JOIN daily_leave dl_leave ON dl_leave.dl_uid = sd.staff_id AND dl_leave.dl_day = sd.ds_day AND dl_leave.leave_category = 'leave'
    LEFT JOIN daily_holiday dh ON dh.dh_uid = sd.staff_id AND dh.dh_day = sd.ds_day
  ),
  day_metrics AS (
    SELECT
      sds.ds_day,
      COUNT(DISTINCT sds.staff_id) FILTER (WHERE sds.has_activity)::INT AS present_cnt,
      COUNT(DISTINCT sds.staff_id) FILTER (WHERE NOT sds.has_activity AND sds.has_wfh)::INT AS wfh_cnt,
      COUNT(DISTINCT sds.staff_id) FILTER (WHERE NOT sds.has_activity AND NOT sds.has_wfh AND sds.has_leave)::INT AS on_leave_cnt,
      COUNT(DISTINCT sds.staff_id) FILTER (
        WHERE NOT sds.has_activity 
          AND NOT sds.has_wfh 
          AND NOT sds.has_leave 
          AND NOT sds.is_holiday_or_weekend
      )::INT AS absent_cnt
    FROM staff_day_status sds
    GROUP BY sds.ds_day
  )
  SELECT
    ds.ds_day,
    dm.present_cnt,
    dm.wfh_cnt,
    dm.on_leave_cnt,
    dm.absent_cnt,
    ROUND(COALESCE(AVG(dw.net_hours), 0)::NUMERIC, 1),
    COUNT(DISTINCT dw.dw_uid)
      FILTER (WHERE dw.first_in IS NOT NULL AND dw.first_in::TIME > v_shift_start)::INT,
    v_active_staff_count::INT
  FROM day_series ds
  LEFT JOIN day_metrics dm ON dm.ds_day = ds.ds_day
  LEFT JOIN daily_work dw ON dw.work_day = ds.ds_day
  GROUP BY ds.ds_day, dm.present_cnt, dm.wfh_cnt, dm.on_leave_cnt, dm.absent_cnt
  ORDER BY ds.ds_day ASC;
END;
$$;
  `.trim();

  console.log('Executing RPC update via exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Failed to update get_attendance_summary function:', error);
  } else {
    console.log('Successfully updated get_attendance_summary function!', data);
  }
}

run();
