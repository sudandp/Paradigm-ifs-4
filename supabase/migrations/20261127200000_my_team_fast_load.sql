-- ============================================================================
-- My Team page: fast team + latest-location lookups
-- Date: 2026-11-27
--
-- 1. get_team_member_ids(p_manager_id)
--    Everyone under a manager through L1/L2/L3, at any depth. Replaces
--    downloading the whole users table and walking it in the browser.
--
-- 2. get_latest_locations(p_user_ids)
--    One row per user: the newest attendance_events row and the newest
--    route_history row that has GPS. Replaces a "newest 300 rows across
--    everyone" query that one chatty device could fill, forcing 2 extra
--    queries per missing user.
--
-- Both are SECURITY DEFINER with explicit access checks (see each function):
-- the tables' row-level policies are too slow for these lookups. Safe to re-run.
-- The api falls back to the old client-side code if these are missing or slow.
-- ============================================================================

-- SECURITY DEFINER so users-table RLS isn't re-evaluated on every row the
-- recursion touches (that made the first version time out). Access is checked
-- explicitly instead: callers get their own team; platform admins "viewing as"
-- someone get that person's team (effective_viewer); anyone else gets nothing.
CREATE OR REPLACE FUNCTION public.get_team_member_ids(p_manager_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Seeded with the manager; UNION (not UNION ALL) discards repeats, so a
  -- reporting cycle terminates. Each branch is a plain indexed equality lookup.
  WITH RECURSIVE team(id) AS (
    SELECT p_manager_id
    WHERE auth.uid() IS NOT NULL
      AND public.effective_viewer(p_manager_id) = p_manager_id
    UNION
    SELECT c.id
    FROM team t
    CROSS JOIN LATERAL (
      SELECT u.id FROM public.users u WHERE u.reporting_manager_id   = t.id
      UNION ALL
      SELECT u.id FROM public.users u WHERE u.reporting_manager_2_id = t.id
      UNION ALL
      SELECT u.id FROM public.users u WHERE u.reporting_manager_3_id = t.id
    ) c
  )
  SELECT id FROM team WHERE id <> p_manager_id;
$$;

-- SECURITY DEFINER: the attendance_events / route_history RLS calls the
-- plpgsql check_is_admin() once PER ROW, which made these reads take 30-60s.
-- Access is checked here once per requested user instead — same people the
-- table policies allow (admin roles, yourself, L1/L2/L3 reports) plus your
-- reporting chain and ticked departments (get_my_visible_user_ids).
CREATE OR REPLACE FUNCTION public.get_latest_locations(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, attendance jsonb, route jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS uid, public.check_is_admin() AS is_admin
  ),
  allowed AS (
    SELECT DISTINCT ids.id
    FROM unnest(p_user_ids) AS ids(id), me
    WHERE me.uid IS NOT NULL
      AND (
        me.is_admin
        OR ids.id = me.uid
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = ids.id
            AND me.uid IN (u.reporting_manager_id, u.reporting_manager_2_id, u.reporting_manager_3_id)
        )
        OR ids.id IN (SELECT public.get_my_visible_user_ids())
      )
  )
  -- Each LATERAL is a single index probe on (user_id, timestamp DESC)
  SELECT ids.id,
         to_jsonb(a.*),
         to_jsonb(r.*)
  FROM allowed AS ids
  LEFT JOIN LATERAL (
    SELECT e.user_id, e.latitude, e.longitude, e."timestamp", e.location_name,
           e.device_name, e.source, e.battery_level, e.ip_address, e.network_type
    FROM public.attendance_events e
    WHERE e.user_id = ids.id
    ORDER BY e."timestamp" DESC
    LIMIT 1
  ) a ON true
  LEFT JOIN LATERAL (
    SELECT h.user_id, h.latitude, h.longitude, h."timestamp",
           h.device_name, h.source, h.battery_level, h.ip_address, h.network_type
    FROM public.route_history h
    WHERE h.user_id = ids.id
      AND h.latitude IS NOT NULL AND h.longitude IS NOT NULL
    ORDER BY h."timestamp" DESC
    LIMIT 1
  ) r ON true;
$$;

-- Indexes the lookups rely on (no-ops where they already exist)
CREATE INDEX IF NOT EXISTS idx_attendance_events_user_ts ON public.attendance_events (user_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_route_history_user_timestamp ON public.route_history (user_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_id   ON public.users (reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_2_id ON public.users (reporting_manager_2_id);
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_3_id ON public.users (reporting_manager_3_id);

REVOKE ALL ON FUNCTION public.get_team_member_ids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_latest_locations(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_member_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_latest_locations(uuid[]) TO authenticated, service_role;
