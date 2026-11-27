-- ============================================================================
-- Notifications: team-scoped read access
-- Date: 2026-11-27
--
-- Who can READ which notifications:
--   * admin, super_admin, developer, management -> all notifications
--   * Reporting managers (site_manager, field_manager, finance, HR, ...)
--       -> their own + everyone below them in the reporting chain
--          (direct AND indirect: Sandeep <- Ravi <- Kumar => Sandeep sees both),
--          via reporting_manager_id / _2_id / _3_id
--   * Everyone else (incl. HR without reports) -> their own only
--
-- UPDATE / DELETE: own notifications, or the see-all roles. A manager can
-- read but NOT mark-read / delete a staff member's notifications.
-- INSERT: unchanged (anyone may send a notification to any user).
--
-- RLS policies are OR-ed together, so every existing policy on the table is
-- dropped first (including any created by hand in the dashboard) and the full
-- set is recreated. Otherwise one leftover permissive policy would undo this.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: all users who report (directly or indirectly) to the caller
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_team_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE team(id, depth) AS (
    -- Direct reports (any of the three reporting-manager slots)
    SELECT u.id, 1
    FROM public.users u
    WHERE auth.uid() IS NOT NULL
      AND (
        u.reporting_manager_id   = auth.uid() OR
        u.reporting_manager_2_id = auth.uid() OR
        u.reporting_manager_3_id = auth.uid()
      )
    UNION
    -- Staff below those reports
    SELECT u.id, t.depth + 1
    FROM public.users u
    JOIN team t ON (
      u.reporting_manager_id   = t.id OR
      u.reporting_manager_2_id = t.id OR
      u.reporting_manager_3_id = t.id
    )
    WHERE t.depth < 10            -- guards against reporting-chain cycles
  )
  SELECT DISTINCT id FROM team WHERE id <> auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_team_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_user_ids() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_team_user_ids() IS
  'User ids reporting to auth.uid() directly or indirectly (reporting_manager_id/_2_id/_3_id). Used by team-scoped RLS policies.';

-- ----------------------------------------------------------------------------
-- 2. Helper: roles that may read every notification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_all_notifications()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role_id IN ('admin', 'super_admin', 'developer', 'management')
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_all_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_all_notifications() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Drop EVERY existing policy on public.notifications
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.notifications', p.policyname);
    RAISE NOTICE 'Dropped notifications policy: %', p.policyname;
  END LOOP;
END $$;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. Recreate the full policy set
-- ----------------------------------------------------------------------------
-- SELECT: own, team (direct + indirect), or see-all roles
CREATE POLICY "notifications_select_own_team_or_admin"
ON public.notifications FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.can_view_all_notifications())
  OR user_id IN (SELECT public.get_my_team_user_ids())
);

-- INSERT: unchanged from 20260723_rls_hotfix_notifications_fcm_cache
CREATE POLICY "notifications_insert_any"
ON public.notifications FOR INSERT TO public
WITH CHECK (true);

-- UPDATE: own, or see-all roles
CREATE POLICY "notifications_update_own_or_admin"
ON public.notifications FOR UPDATE TO authenticated
USING      (user_id = (SELECT auth.uid()) OR (SELECT public.can_view_all_notifications()))
WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT public.can_view_all_notifications()));

-- DELETE: own, or see-all roles
CREATE POLICY "notifications_delete_own_or_admin"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT public.can_view_all_notifications()));

-- ----------------------------------------------------------------------------
-- 5. Indexes for the reporting-chain walk in get_my_team_user_ids()
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_id   ON public.users (reporting_manager_id);
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_2_id ON public.users (reporting_manager_2_id);
CREATE INDEX IF NOT EXISTS idx_users_reporting_manager_3_id ON public.users (reporting_manager_3_id);
