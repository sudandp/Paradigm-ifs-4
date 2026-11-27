-- ============================================================================
-- Approvals: department-based for senior roles, L1-based for everyone else
-- Date: 2026-11-27
-- Builds on: 20261127140000 (responsibility_areas, roles.department),
--            20261127150000 (business_development), 20261127170000 (effective_viewer)
--
-- Who may act on an employee's leave / unlock / OT-claim / finance request:
--   * Senior roles (director, chief_*, ceo, coo, cto, cfo, cxo, management,
--     general_manager) WITH departments ticked
--       -> every employee whose role's department is ticked
--          (Ankur: Finance + Business Development), regardless of L1/L2/L3
--   * Everyone else (and senior roles with nothing ticked)
--       -> employees whose L1 manager they are; as L2/L3 only when the
--          employee has no L1
-- admin / super_admin / developer are not limited (the app skips this filter).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_area_scoped_role(p_role text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(coalesce(p_role, '')) IN
           ('management', 'director', 'ceo', 'coo', 'cto', 'cfo', 'cxo', 'general_manager')
      OR lower(coalesce(p_role, '')) LIKE 'chief\_%'
      OR lower(coalesce(p_role, '')) LIKE '%director%';
$$;

-- Employees the caller (or, for an admin "viewing as", p_as_user) approves for
CREATE OR REPLACE FUNCTION public.get_my_approvee_ids(p_as_user uuid DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH v AS (
    SELECT u.id, u.role_id, coalesce(u.responsibility_areas, '{}') AS areas
    FROM public.users u
    WHERE u.id = public.effective_viewer(p_as_user)
  )
  SELECT u.id
  FROM public.users u, v
  WHERE auth.uid() IS NOT NULL
    AND u.id <> v.id
    AND CASE
          WHEN public.is_area_scoped_role(v.role_id) AND cardinality(v.areas) > 0 THEN
            EXISTS (
              SELECT 1 FROM public.roles r
              WHERE r.id = u.role_id
                AND r.department IS NOT NULL
                AND r.department = ANY (v.areas)
            )
          ELSE
            u.reporting_manager_id = v.id
            OR (u.reporting_manager_id IS NULL
                AND v.id IN (u.reporting_manager_2_id, u.reporting_manager_3_id))
        END;
$$;

REVOKE ALL ON FUNCTION public.get_my_approvee_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_approvee_ids(uuid) TO authenticated, service_role;
