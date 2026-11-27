-- ============================================================================
-- HR Onboarding users: alerts + "Awaiting Verification" queue, scoped by company
-- Date: 2026-11-27
-- Builds on: 20261127170000_onboarding_approvals_impersonation.sql (effective_viewer)
--
-- HR onboarding roles (hr_onboarding, hr_onboaring) get, for submissions of
-- THEIR company (users.society_id = company of the submission's site):
--   * alert on new submission                       (event 'submitted')
--   * alert when a rejected submission is resubmitted (event 'resubmitted')
--   * alert on FCU pass / fail                      (event 'fcu_result';
--     also sent to whoever verified the submission)
--   * a queue of submissions awaiting verification  (get_my_onboarding_queue)
--
-- Submission -> company: the company chosen on the onboarding form
-- (organization.company_id); else the site's entity (by id, else normalised
-- name) with the app's fallback from api.getOrganizationStructure.
-- ============================================================================

-- Remove earlier drafts of these helpers (fewer arguments) so calls with
-- defaulted arguments are never ambiguous when this file is re-run.
DROP FUNCTION IF EXISTS public.get_onboarding_hr_recipients(text);
DROP FUNCTION IF EXISTS public.get_onboarding_hr_recipients(text, text);
DROP FUNCTION IF EXISTS public.get_site_company_id(text);
DROP FUNCTION IF EXISTS public.get_site_company_id(text, text);

-- Roles treated as HR onboarding (incl. the misspelt production role id)
CREATE OR REPLACE FUNCTION public.is_hr_onboarding_role(p_role text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(coalesce(p_role, '')) IN ('hr_onboarding', 'hr_onboaring');
$$;

-- Company of a submission's site (mirrors the app's entity -> company fallback).
-- Site lookup: by entity id / organization_id first; if the submission's id is
-- not in entities (seen in production), by site name ignoring case, spaces and
-- punctuation ("UBER  VERDANT PHASE 2" = "Uber Verdant Phase-2").
CREATE OR REPLACE FUNCTION public.normalize_site_name(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT nullif(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.get_site_company_id(
  p_org_id   text,
  p_org_name text  DEFAULT NULL,
  p_org_json jsonb DEFAULT NULL   -- onboarding_submissions.organization
)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    -- 1. Company chosen on the onboarding form (also covers manual_ sites and
    --    non-Bangalore sites that are not in entities)
    (SELECT c FROM (SELECT nullif(coalesce(p_org_json ->> 'company_id', p_org_json ->> 'companyId'), '') AS c) x
      WHERE c IS NOT NULL AND c <> 'unassigned_company'),
    -- 2. The site's entity: by id, else by normalised name; app fallback when company_id is empty
    (SELECT CASE
        WHEN nullif(e.company_id, '') IS NOT NULL AND e.company_id <> 'unassigned_company' THEN e.company_id
        WHEN upper(coalesce(e.billing_controls ->> 'operatingCompany', e.billing_controls ->> 'operating_company', '')) LIKE '%PPFMS%' THEN 'comp_ppfms'
        WHEN upper(coalesce(e.billing_controls ->> 'operatingCompany', e.billing_controls ->> 'operating_company', '')) ~ '(SWLLP|SOUTHWALL)' THEN 'comp_1774527590821'
        WHEN lower(coalesce(e.location, '')) LIKE '%hyd%' THEN 'comp_1775122124670'
        ELSE 'comp_1774006215885'
      END
      FROM public.entities e
      WHERE (p_org_id IS NOT NULL AND (e.id::text = p_org_id OR e.organization_id::text = p_org_id))
         OR (public.normalize_site_name(p_org_name) IS NOT NULL
             AND public.normalize_site_name(e.name) = public.normalize_site_name(p_org_name))
      ORDER BY coalesce(p_org_id IS NOT NULL AND (e.id::text = p_org_id OR e.organization_id::text = p_org_id), false) DESC  -- id match wins (NULL-safe)
      LIMIT 1)
  );
$$;

REVOKE ALL ON FUNCTION public.get_site_company_id(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_site_company_id(text, text, jsonb) TO authenticated, service_role;

-- HR onboarding users responsible for a site (same company)
CREATE OR REPLACE FUNCTION public.get_onboarding_hr_recipients(p_org_id text, p_org_name text DEFAULT NULL, p_org_json jsonb DEFAULT NULL)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id
  FROM public.users u
  WHERE public.is_hr_onboarding_role(u.role_id)
    AND u.society_id IS NOT NULL
    AND u.society_id::text = public.get_site_company_id(p_org_id, p_org_name, p_org_json);
$$;

REVOKE ALL ON FUNCTION public.get_onboarding_hr_recipients(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_hr_recipients(text, text, jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- Create the in-app alerts. Returns recipient ids (the app sends push to them).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_onboarding_hr(
  p_submission_id text,
  p_event         text,     -- 'submitted' | 'resubmitted' | 'fcu_result'
  p_message       text,
  p_severity      text DEFAULT 'Medium'
)
RETURNS uuid[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub        record;
  v_recipients uuid[];
  v_type       text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_event NOT IN ('submitted', 'resubmitted', 'fcu_result') THEN
    RAISE EXCEPTION 'Unknown onboarding event %', p_event;
  END IF;

  SELECT s.id, s.organization_id::text AS org_id, s.organization_name AS org_name, s.organization::jsonb AS org_json, s.verified_by::text AS verified_by
    INTO v_sub
  FROM public.onboarding_submissions s
  WHERE s.id::text = p_submission_id;
  IF NOT FOUND THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  SELECT coalesce(array_agg(DISTINCT r), ARRAY[]::uuid[]) INTO v_recipients
  FROM (
    SELECT public.get_onboarding_hr_recipients(v_sub.org_id, v_sub.org_name, v_sub.org_json) AS r
    UNION
    -- FCU result also goes to whoever verified it (stored as user id or name)
    SELECT u.id FROM public.users u
    WHERE p_event = 'fcu_result'
      AND v_sub.verified_by IS NOT NULL
      AND (u.id::text = v_sub.verified_by OR lower(trim(u.name)) = lower(trim(v_sub.verified_by)))
  ) x
  WHERE r IS NOT NULL AND r <> auth.uid();   -- don't alert the person who did it

  v_type := CASE WHEN p_event = 'fcu_result' THEN 'info' ELSE 'approval_request' END;

  INSERT INTO public.notifications (user_id, message, type, link_to, severity, metadata)
  SELECT r, p_message, v_type, '/verification/dashboard', p_severity,
         jsonb_build_object('submissionId', p_submission_id, 'onboardingEvent', p_event)
  FROM unnest(v_recipients) AS r;

  RETURN v_recipients;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_onboarding_hr(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_onboarding_hr(text, text, text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- "Awaiting Verification" queue for the notification panel
--   HR onboarding -> pending submissions of their company
--   platform admin (own view) -> all pending
--   everyone else -> nothing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_onboarding_queue(p_as_user uuid DEFAULT NULL)
RETURNS SETOF public.onboarding_submissions
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH viewer AS (
    SELECT u.id, u.role_id, u.society_id::text AS company_id
    FROM public.users u
    WHERE u.id = public.effective_viewer(p_as_user)
  )
  SELECT s.*
  FROM public.onboarding_submissions s, viewer v
  WHERE auth.uid() IS NOT NULL
    AND s.status = 'pending'
    AND (
          lower(v.role_id) IN ('admin', 'super_admin', 'developer')
       OR (public.is_hr_onboarding_role(v.role_id)
           AND v.company_id IS NOT NULL
           AND v.company_id = public.get_site_company_id(s.organization_id::text, s.organization_name, s.organization::jsonb))
        )
  ORDER BY s.created_at ASC;   -- oldest first: the queue order HR should work in
$$;

REVOKE ALL ON FUNCTION public.get_my_onboarding_queue(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_onboarding_queue(uuid) TO authenticated, service_role;
