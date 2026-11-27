-- ============================================================================
-- Department responsibility scoping for senior roles
-- Date: 2026-11-27
-- Builds on: 20261127130000_notifications_team_scoped_rls.sql
--
-- Problem: every director / CXO / management user could see every record.
-- A company may have 5 directors: one Finance, one Operations, one both,
-- one Field Staff, one Site Staff. Each must see only their departments.
--
-- Model:
--   * roles.department           -> which department a role's staff belong to
--                                   (finance | operations | field_staff | site_staff | hr)
--   * users.responsibility_areas -> departments a senior user is responsible for
--                                   (checkboxes on Edit User, admin-only)
--
-- Visibility (notifications in this migration; other tables reuse
-- get_my_visible_user_ids() later):
--   * admin, super_admin, developer -> everything
--   * everyone else (incl. director, ceo, management) ->
--       own + reporting chain below them + all staff whose role's department
--       is ticked in their responsibility_areas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. roles.department (seeded from role id; admin can correct afterwards)
-- ----------------------------------------------------------------------------
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS department text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_department_check'
  ) THEN
    ALTER TABLE public.roles ADD CONSTRAINT roles_department_check
      CHECK (department IS NULL OR department IN ('finance', 'operations', 'field_staff', 'site_staff', 'hr'));
  END IF;
END $$;

-- Seed only roles that have no department yet (re-running never overwrites manual edits).
-- Senior / admin roles are deliberately left NULL: they are not "staff of" a department.
UPDATE public.roles r
SET department = CASE
    WHEN r.id ~* '(financ|account|billing|invoice|payroll)'                         THEN 'finance'
    WHEN r.id ~* '^(hr|hr_.*)$|recruit|human_resource'                              THEN 'hr'
    WHEN r.id ~* 'field'                                                            THEN 'field_staff'
    WHEN r.id ~* '(operation|^ops_|_ops$|site_manager|area_manager|supervisor|facility|business_developer)' THEN 'operations'
    WHEN r.id ~* '(security|guard|housekeep|cleaner|janitor|technician|electric|plumb|garden|lift|mep|multi_tech|stp|wtp|pool|driver|site_staff|helper|attendant|bouncer|lady_guard|fire)' THEN 'site_staff'
    ELSE NULL
  END
WHERE r.department IS NULL
  AND r.id NOT IN ('admin', 'super_admin', 'superadmin', 'developer', 'management', 'director',
                   'ceo', 'coo', 'cto', 'cfo', 'cxo', 'general_manager', 'unverified', 'gate_only')
  AND r.id !~* '^chief_|director';

-- Explicit mapping for production roles the patterns above don't catch
-- (confirmed 2026-11-27). Still only fills roles without a department.
UPDATE public.roles r
SET department = m.department
FROM (VALUES
  ('multitech',                             'site_staff'),
  ('pantry_boy',                            'site_staff'),
  ('technical_reliever',                    'site_staff'),
  ('afm_-_technical',                       'operations'),
  ('technical_manager',                     'operations'),
  ('procurement_co-ordinator',              'operations'),
  ('procurement_executive',                 'operations'),
  ('senior_procurement_manager',            'operations'),
  ('auditor',                               'operations'),   -- site audit / snag reports
  ('senior_manager_–_client_partnerships',  'operations')    -- note: en dash in role id
) AS m(role_id, department)
WHERE r.id = m.role_id
  AND r.department IS NULL;

-- Intentionally no department (not visible through director checkboxes):
--   admin_manager, assistant_manager_-_admin  (office administration)
--   client_panel, kiosk                       (not employees)

-- Tell the operator which roles still need a department set by hand
DO $$
DECLARE
  unmapped text;
BEGIN
  SELECT string_agg(id, ', ' ORDER BY id) INTO unmapped
  FROM public.roles
  WHERE department IS NULL
    AND id NOT IN ('admin', 'super_admin', 'superadmin', 'developer', 'management', 'director',
                   'ceo', 'coo', 'cto', 'cfo', 'cxo', 'general_manager', 'unverified', 'gate_only',
                   'admin_manager', 'assistant_manager_-_admin', 'client_panel', 'kiosk')
    AND id !~* '^chief_|director';
  IF unmapped IS NOT NULL THEN
    RAISE NOTICE 'Roles without a department (directors will not see these staff via checkboxes): %', unmapped;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. users.responsibility_areas (the Edit User checkboxes)
-- ----------------------------------------------------------------------------
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS responsibility_areas text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_responsibility_areas_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_responsibility_areas_check
      CHECK (responsibility_areas <@ ARRAY['finance', 'operations', 'field_staff', 'site_staff', 'hr']::text[]);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Only admin / super_admin / developer may set responsibility areas or
--    role departments. users RLS lets people update their own row, so
--    without this anyone could tick every box for themselves.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role_id IN ('admin', 'super_admin', 'developer')
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_responsibility_areas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() IS NULL => service role / SQL editor / cron: allowed
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND coalesce(array_length(NEW.responsibility_areas, 1), 0) > 0 THEN
    RAISE EXCEPTION 'Only admin can assign responsibility areas' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.responsibility_areas IS DISTINCT FROM OLD.responsibility_areas THEN
    RAISE EXCEPTION 'Only admin can change responsibility areas' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_responsibility_areas ON public.users;
CREATE TRIGGER trg_guard_responsibility_areas
  BEFORE INSERT OR UPDATE OF responsibility_areas ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_responsibility_areas();

CREATE OR REPLACE FUNCTION public.guard_role_department()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'INSERT' AND NEW.department IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.department IS DISTINCT FROM OLD.department) THEN
    RAISE EXCEPTION 'Only admin can change a role''s department' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_role_department ON public.roles;
CREATE TRIGGER trg_guard_role_department
  BEFORE INSERT OR UPDATE OF department ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_role_department();

-- ----------------------------------------------------------------------------
-- 4. Helpers: department staff + everything the caller may see
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_department_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.users me
  JOIN public.users u  ON u.id <> me.id
  JOIN public.roles r  ON r.id = u.role_id
  WHERE me.id = auth.uid()
    AND r.department IS NOT NULL
    AND r.department = ANY (me.responsibility_areas);
$$;

REVOKE ALL ON FUNCTION public.get_my_department_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_department_user_ids() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_my_visible_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.uid FROM public.get_my_team_user_ids() AS t(uid)
  UNION
  SELECT d.uid FROM public.get_my_department_user_ids() AS d(uid);
$$;

REVOKE ALL ON FUNCTION public.get_my_visible_user_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_visible_user_ids() TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_visible_user_ids() IS
  'Users the caller may see records of: reporting chain below them + staff in their responsibility_areas. Excludes the caller.';

-- ----------------------------------------------------------------------------
-- 5. Notifications: only admin / super_admin / developer see everything;
--    management, directors, CXOs are scoped by their checkboxes.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_all_notifications()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin();
$$;

DROP POLICY IF EXISTS "notifications_select_own_team_or_admin" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select_own_visible_or_admin" ON public.notifications;

CREATE POLICY "notifications_select_own_visible_or_admin"
ON public.notifications FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.can_view_all_notifications())
  OR user_id IN (SELECT public.get_my_visible_user_ids())
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users (role_id);
