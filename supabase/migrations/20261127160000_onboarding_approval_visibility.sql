-- ============================================================================
-- Onboarding approvals: show each submission only to the people responsible
-- Date: 2026-11-27
-- Builds on: 20261127140000_department_responsibility_scoping.sql (is_platform_admin)
--
-- Before: every manager-type user (site manager, business developer, finance,
-- anyone with a team...) saw ALL verified onboarding submissions company-wide.
--
-- A submission (site = onboarding_submissions.organization_id / organization_name)
-- is now visible to:
--   1. admin / super_admin / developer
--   2. the new employee's reporting manager (organization.reporting_manager, by name)
--   3. the site's ops manager, HR incharge and site manager in site_responsibility_matrix
--   4. site managers, operation managers and HR users assigned to that site
--      (users.organization_id, a comma-separated list of site ids)
--
-- Exposed as RPCs used by the notification panel and badge count. Table RLS on
-- onboarding_submissions is NOT changed here (onboarding forms, verification
-- and FCU pages still depend on it); that is tracked separately.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_view_onboarding_submission(
  p_org_id   text,
  p_org_name text,
  p_org_json jsonb
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT u.id, lower(trim(u.name)) AS name, lower(u.role_id) AS role_id,
           string_to_array(replace(coalesce(u.organization_id, ''), ' ', ''), ',') AS site_ids
    FROM public.users u
    WHERE u.id = auth.uid()
  )
  SELECT EXISTS (
    SELECT 1 FROM me
    WHERE
      -- 1. platform admins
      public.is_platform_admin()

      -- 2. reporting manager named on the onboarding form
      OR (me.name <> '' AND me.name = lower(trim(coalesce(
            p_org_json ->> 'reporting_manager',
            p_org_json ->> 'reportingManager', ''))))

      -- 3. responsibility matrix for this site
      OR EXISTS (
        SELECT 1 FROM public.site_responsibility_matrix m
        WHERE (
                (p_org_id IS NOT NULL AND m.organization_id = p_org_id)
             OR (p_org_name IS NOT NULL AND lower(trim(m.site_name)) = lower(trim(p_org_name)))
              )
          AND me.id IN (m.ops_manager_id, m.hr_incharge_id, m.site_manager_id)
      )

      -- 4. site / operations managers and HR assigned to this site
      OR (
        p_org_id IS NOT NULL
        AND p_org_id = ANY (me.site_ids)
        AND (
             me.role_id LIKE 'site_manager%'
          OR me.role_id LIKE 'operation_manager%'
          OR me.role_id IN ('hr', 'hr_ops', 'hr_onboarding', 'hr_onboaring', 'hr_recruitment')
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_onboarding_submission(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_onboarding_submission(text, text, jsonb) TO authenticated, service_role;

-- Verified submissions awaiting FCU acknowledgement that the caller may act on
CREATE OR REPLACE FUNCTION public.get_my_onboarding_approvals()
RETURNS SETOF public.onboarding_submissions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.onboarding_submissions s
  WHERE s.status = 'verified'
    AND s.fcu_status IS NULL
    AND public.can_view_onboarding_submission(s.organization_id::text, s.organization_name, s.organization::jsonb)
  ORDER BY s.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_onboarding_approvals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_onboarding_approvals() TO authenticated, service_role;

-- Count of pending (not yet verified) submissions the caller is responsible for
CREATE OR REPLACE FUNCTION public.count_my_pending_onboarding()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.onboarding_submissions s
  WHERE s.status = 'pending'
    AND public.can_view_onboarding_submission(s.organization_id::text, s.organization_name, s.organization::jsonb);
$$;

REVOKE ALL ON FUNCTION public.count_my_pending_onboarding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_my_pending_onboarding() TO authenticated, service_role;
