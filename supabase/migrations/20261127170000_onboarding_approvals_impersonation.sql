-- ============================================================================
-- Onboarding approvals: evaluate visibility for an impersonated user
-- Date: 2026-11-27
-- Builds on: 20261127160000_onboarding_approval_visibility.sql
--
-- "Viewing as <user>" only swaps the user in the app; the database session
-- stays the admin's, so auth.uid() = admin and every approval was returned.
-- The RPCs now take an optional p_as_user. It is honoured ONLY when the real
-- caller is admin / super_admin / developer; anyone else always gets their own
-- view (p_as_user is ignored), so it cannot be used to peek at other users.
-- ============================================================================

-- Core rule, parameterised by user (replaces the auth.uid()-only version)
CREATE OR REPLACE FUNCTION public.can_user_view_onboarding_submission(
  p_user     uuid,
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
    WHERE u.id = p_user
  )
  SELECT EXISTS (
    SELECT 1 FROM me
    WHERE
      me.role_id IN ('admin', 'super_admin', 'developer')
      OR (me.name <> '' AND me.name = lower(trim(coalesce(
            p_org_json ->> 'reporting_manager',
            p_org_json ->> 'reportingManager', ''))))
      OR EXISTS (
        SELECT 1 FROM public.site_responsibility_matrix m
        WHERE (
                (p_org_id IS NOT NULL AND m.organization_id = p_org_id)
             OR (p_org_name IS NOT NULL AND lower(trim(m.site_name)) = lower(trim(p_org_name)))
              )
          AND me.id IN (m.ops_manager_id, m.hr_incharge_id, m.site_manager_id)
      )
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

REVOKE ALL ON FUNCTION public.can_user_view_onboarding_submission(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_view_onboarding_submission(uuid, text, text, jsonb) TO service_role;

-- Keep the old 3-arg helper working (own view only)
CREATE OR REPLACE FUNCTION public.can_view_onboarding_submission(
  p_org_id text, p_org_name text, p_org_json jsonb
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.can_user_view_onboarding_submission(auth.uid(), p_org_id, p_org_name, p_org_json);
$$;

-- Whose view to compute: p_as_user only if the real caller is a platform admin
CREATE OR REPLACE FUNCTION public.effective_viewer(p_as_user uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_as_user IS NOT NULL AND p_as_user <> auth.uid() AND public.is_platform_admin() THEN p_as_user
    ELSE auth.uid()
  END;
$$;

REVOKE ALL ON FUNCTION public.effective_viewer(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_viewer(uuid) TO service_role;

-- Replace the zero-arg RPCs (a defaulted param would make calls ambiguous)
DROP FUNCTION IF EXISTS public.get_my_onboarding_approvals();
DROP FUNCTION IF EXISTS public.count_my_pending_onboarding();

CREATE OR REPLACE FUNCTION public.get_my_onboarding_approvals(p_as_user uuid DEFAULT NULL)
RETURNS SETOF public.onboarding_submissions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.*
  FROM public.onboarding_submissions s
  WHERE auth.uid() IS NOT NULL
    AND s.status = 'verified'
    AND s.fcu_status IS NULL
    AND public.can_user_view_onboarding_submission(
          public.effective_viewer(p_as_user),
          s.organization_id::text, s.organization_name, s.organization::jsonb)
  ORDER BY s.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.count_my_pending_onboarding(p_as_user uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.onboarding_submissions s
  WHERE auth.uid() IS NOT NULL
    AND s.status = 'pending'
    AND public.can_user_view_onboarding_submission(
          public.effective_viewer(p_as_user),
          s.organization_id::text, s.organization_name, s.organization::jsonb);
$$;

REVOKE ALL ON FUNCTION public.get_my_onboarding_approvals(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.count_my_pending_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_onboarding_approvals(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_my_pending_onboarding(uuid) TO authenticated, service_role;
