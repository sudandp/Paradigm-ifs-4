-- ============================================================================
-- SECURITY HARDENING & RLS STABILITY (PHASE A & B) - CASTING & TYPE SAFETY
-- Date: 2026-07-23
-- Fixes: Permissive RLS ("always true"), Unprotected Tables, SECURITY DEFINER Exposure,
--        Schema Column Names & Type Casting (text = uuid operator safety via ::text),
--        and InitPlan (select auth.uid()) Performance Optimizations.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. HELPER FUNCTION & SCHEMA HOTFIXES: InitPlan-optimized Role Check & updated_at column
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_role(target_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id::text = (SELECT auth.uid())::text
    AND role_id = ANY(target_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_user_role(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_role(text[]) TO service_role;

-- Fix: Add updated_at column to rule_inheritance_cache to prevent 'record "new" has no field "updated_at"' error
ALTER TABLE IF EXISTS public.rule_inheritance_cache 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.rule_inheritance_cache;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.rule_inheritance_cache
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 1. SECURITY DEFINER HARDENING (Fix 0028/0029 - Function Privilege Escalation)
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.safe_alter_job FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.safe_alter_job TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.safe_alter_job(
    job_id bigint,
    schedule text DEFAULT NULL,
    command text DEFAULT NULL,
    db text DEFAULT NULL,
    username text DEFAULT NULL,
    active boolean DEFAULT NULL
) RETURNS void AS $$
BEGIN
    IF NOT public.check_user_role(ARRAY['admin', 'super_admin', 'developer']) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can modify scheduled jobs.';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'cron' AND proname = 'alter_job') THEN
        PERFORM cron.alter_job(job_id, schedule, command, db, username, active);
    ELSE
        RAISE NOTICE 'pg_cron extension or cron.alter_job function is not available.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not execute cron.alter_job: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- 2. HARDEN UNPROTECTED TABLES (RLS Enabled but No Policies)
-- ----------------------------------------------------------------------------

-- A. api_rate_limits (uses hr_user_id)
ALTER TABLE IF EXISTS public.api_rate_limits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_rate_limits TO authenticated, service_role;

DROP POLICY IF EXISTS "api_rate_limits_select" ON public.api_rate_limits;
DROP POLICY IF EXISTS "api_rate_limits_insert" ON public.api_rate_limits;
DROP POLICY IF EXISTS "api_rate_limits_update" ON public.api_rate_limits;

CREATE POLICY "api_rate_limits_select" ON public.api_rate_limits FOR SELECT TO authenticated
USING (hr_user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'developer']));

CREATE POLICY "api_rate_limits_insert" ON public.api_rate_limits FOR INSERT TO authenticated
WITH CHECK (hr_user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'developer']));

CREATE POLICY "api_rate_limits_update" ON public.api_rate_limits FOR UPDATE TO authenticated
USING (hr_user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'developer']))
WITH CHECK (hr_user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'developer']));

-- B. billing_configs
ALTER TABLE IF EXISTS public.billing_configs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_configs TO authenticated, service_role;

DROP POLICY IF EXISTS "billing_configs_manage" ON public.billing_configs;

CREATE POLICY "billing_configs_manage" ON public.billing_configs FOR ALL TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'finance', 'management']))
WITH CHECK (public.check_user_role(ARRAY['admin', 'super_admin', 'finance', 'management']));

-- C. client_nda_templates
ALTER TABLE IF EXISTS public.client_nda_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_nda_templates TO authenticated, service_role;

DROP POLICY IF EXISTS "client_nda_templates_select" ON public.client_nda_templates;
DROP POLICY IF EXISTS "client_nda_templates_manage" ON public.client_nda_templates;

CREATE POLICY "client_nda_templates_select" ON public.client_nda_templates FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "client_nda_templates_manage" ON public.client_nda_templates FOR ALL TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'legal', 'management']))
WITH CHECK (public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'legal', 'management']));

-- D. document_expiry_vault (uses employee_id)
ALTER TABLE IF EXISTS public.document_expiry_vault ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_expiry_vault TO authenticated, service_role;

DROP POLICY IF EXISTS "document_expiry_vault_select" ON public.document_expiry_vault;
DROP POLICY IF EXISTS "document_expiry_vault_manage" ON public.document_expiry_vault;

CREATE POLICY "document_expiry_vault_select" ON public.document_expiry_vault FOR SELECT TO authenticated
USING (employee_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'management']));

CREATE POLICY "document_expiry_vault_manage" ON public.document_expiry_vault FOR ALL TO authenticated
USING (employee_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'management']))
WITH CHECK (employee_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'management']));


-- ----------------------------------------------------------------------------
-- 3. REMOVE OVERLY PERMISSIVE ("ALWAYS TRUE") POLICIES & HARDEN ATTENDANCE / LOGS
-- ----------------------------------------------------------------------------

-- A. attendance_daily_status_log (uses user_id)
ALTER TABLE IF EXISTS public.attendance_daily_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.attendance_daily_status_log;
DROP POLICY IF EXISTS "attendance_daily_status_log_permissive" ON public.attendance_daily_status_log;
DROP POLICY IF EXISTS "attendance_daily_status_log_select" ON public.attendance_daily_status_log;
DROP POLICY IF EXISTS "attendance_daily_status_log_manage" ON public.attendance_daily_status_log;

CREATE POLICY "attendance_daily_status_log_select" ON public.attendance_daily_status_log FOR SELECT TO authenticated
USING (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management', 'reporting_manager']));

CREATE POLICY "attendance_daily_status_log_manage" ON public.attendance_daily_status_log FOR ALL TO authenticated
USING (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops']))
WITH CHECK (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops']));

-- B. attendance_month_snapshots (uses employee_id)
ALTER TABLE IF EXISTS public.attendance_month_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.attendance_month_snapshots;
DROP POLICY IF EXISTS "attendance_month_snapshots_select" ON public.attendance_month_snapshots;
DROP POLICY IF EXISTS "attendance_month_snapshots_manage" ON public.attendance_month_snapshots;

CREATE POLICY "attendance_month_snapshots_select" ON public.attendance_month_snapshots FOR SELECT TO authenticated
USING (employee_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management', 'reporting_manager']));

CREATE POLICY "attendance_month_snapshots_manage" ON public.attendance_month_snapshots FOR ALL TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops']))
WITH CHECK (public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops']));

-- C. attendance_rule_versions
ALTER TABLE IF EXISTS public.attendance_rule_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.attendance_rule_versions;
DROP POLICY IF EXISTS "attendance_rule_versions_select" ON public.attendance_rule_versions;
DROP POLICY IF EXISTS "attendance_rule_versions_manage" ON public.attendance_rule_versions;

CREATE POLICY "attendance_rule_versions_select" ON public.attendance_rule_versions FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "attendance_rule_versions_manage" ON public.attendance_rule_versions FOR ALL TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management']))
WITH CHECK (public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management']));

-- D. email_logs (uses recipient_email)
ALTER TABLE IF EXISTS public.email_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.email_logs;
DROP POLICY IF EXISTS "Allow authenticated read on email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "Allow authenticated write on email_logs" ON public.email_logs;
DROP POLICY IF EXISTS "email_logs_select" ON public.email_logs;
DROP POLICY IF EXISTS "email_logs_manage" ON public.email_logs;

CREATE POLICY "email_logs_select" ON public.email_logs FOR SELECT TO authenticated
USING (
    recipient_email = (SELECT email FROM public.users WHERE id::text = (SELECT auth.uid())::text) OR 
    public.check_user_role(ARRAY['admin', 'super_admin', 'developer', 'hr', 'management'])
);

CREATE POLICY "email_logs_manage" ON public.email_logs FOR ALL TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'developer']))
WITH CHECK (public.check_user_role(ARRAY['admin', 'super_admin', 'developer']));

-- E. gate_attendance_logs & gate_users (uses user_id)
ALTER TABLE IF EXISTS public.gate_attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.gate_attendance_logs;
DROP POLICY IF EXISTS "gate_logs_select_all" ON public.gate_attendance_logs;
DROP POLICY IF EXISTS "gate_logs_insert_all" ON public.gate_attendance_logs;
DROP POLICY IF EXISTS "gate_attendance_logs_select" ON public.gate_attendance_logs;
DROP POLICY IF EXISTS "gate_attendance_logs_manage" ON public.gate_attendance_logs;

CREATE POLICY "gate_attendance_logs_select" ON public.gate_attendance_logs FOR SELECT TO authenticated
USING (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'security', 'gatekeeper', 'hr', 'management']));

CREATE POLICY "gate_attendance_logs_manage" ON public.gate_attendance_logs FOR ALL TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'security', 'gatekeeper', 'hr']))
WITH CHECK (public.check_user_role(ARRAY['admin', 'super_admin', 'security', 'gatekeeper', 'hr']));

ALTER TABLE IF EXISTS public.gate_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.gate_users;
DROP POLICY IF EXISTS "gate_users_select_admin" ON public.gate_users;
DROP POLICY IF EXISTS "gate_users_insert_admin" ON public.gate_users;
DROP POLICY IF EXISTS "gate_users_update_admin" ON public.gate_users;
DROP POLICY IF EXISTS "gate_users_select" ON public.gate_users;
DROP POLICY IF EXISTS "gate_users_manage" ON public.gate_users;

CREATE POLICY "gate_users_select" ON public.gate_users FOR SELECT TO authenticated
USING (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'security', 'gatekeeper', 'hr', 'management']));

CREATE POLICY "gate_users_manage" ON public.gate_users FOR ALL TO authenticated
USING (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'security', 'gatekeeper', 'hr']))
WITH CHECK (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'security', 'gatekeeper', 'hr']));

-- F. hrm_activity_feed (uses actor_id) & hrm_call_logs (uses called_by)
ALTER TABLE IF EXISTS public.hrm_activity_feed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.hrm_activity_feed;
DROP POLICY IF EXISTS "hrm_activity_feed_select" ON public.hrm_activity_feed;
DROP POLICY IF EXISTS "hrm_activity_feed_manage" ON public.hrm_activity_feed;

CREATE POLICY "hrm_activity_feed_select" ON public.hrm_activity_feed FOR SELECT TO authenticated
USING (actor_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management']));

CREATE POLICY "hrm_activity_feed_manage" ON public.hrm_activity_feed FOR ALL TO authenticated
USING (actor_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management']))
WITH CHECK (actor_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management']));

ALTER TABLE IF EXISTS public.hrm_call_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.hrm_call_logs;
DROP POLICY IF EXISTS "hrm_call_logs_select" ON public.hrm_call_logs;
DROP POLICY IF EXISTS "hrm_call_logs_manage" ON public.hrm_call_logs;

CREATE POLICY "hrm_call_logs_select" ON public.hrm_call_logs FOR SELECT TO authenticated
USING (called_by::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management']));

CREATE POLICY "hrm_call_logs_manage" ON public.hrm_call_logs FOR ALL TO authenticated
USING (called_by::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management']))
WITH CHECK (called_by::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'hr', 'hr_ops', 'management']));

-- G. inventory_items
ALTER TABLE IF EXISTS public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_manage" ON public.inventory_items;

CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "inventory_items_manage" ON public.inventory_items FOR ALL TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'inventory_manager', 'asset_manager', 'management']))
WITH CHECK (public.check_user_role(ARRAY['admin', 'super_admin', 'inventory_manager', 'asset_manager', 'management']));

-- H. kiosk_devices
ALTER TABLE IF EXISTS public.kiosk_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_select_all" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_all_all" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_insert_all" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_update_all" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_select" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_manage" ON public.kiosk_devices;

CREATE POLICY "kiosk_devices_select" ON public.kiosk_devices FOR SELECT TO authenticated
USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "kiosk_devices_manage" ON public.kiosk_devices FOR ALL TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'security', 'kiosk_admin', 'management', 'hr']))
WITH CHECK (public.check_user_role(ARRAY['admin', 'super_admin', 'security', 'kiosk_admin', 'management', 'hr']));

-- I. payroll_snapshots (uses user_id)
ALTER TABLE IF EXISTS public.payroll_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.payroll_snapshots;
DROP POLICY IF EXISTS "payroll_snapshots_select" ON public.payroll_snapshots;
DROP POLICY IF EXISTS "payroll_snapshots_manage" ON public.payroll_snapshots;

CREATE POLICY "payroll_snapshots_select" ON public.payroll_snapshots FOR SELECT TO authenticated
USING (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'finance', 'payroll_admin', 'hr']));

CREATE POLICY "payroll_snapshots_manage" ON public.payroll_snapshots FOR ALL TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'finance', 'payroll_admin']))
WITH CHECK (public.check_user_role(ARRAY['admin', 'super_admin', 'finance', 'payroll_admin']));

-- J. reimbursement_claims (uses user_id)
ALTER TABLE IF EXISTS public.reimbursement_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.reimbursement_claims;
DROP POLICY IF EXISTS "reimbursement_claims_select" ON public.reimbursement_claims;
DROP POLICY IF EXISTS "reimbursement_claims_insert" ON public.reimbursement_claims;
DROP POLICY IF EXISTS "reimbursement_claims_update" ON public.reimbursement_claims;

CREATE POLICY "reimbursement_claims_select" ON public.reimbursement_claims FOR SELECT TO authenticated
USING (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'finance', 'management', 'reporting_manager']));

CREATE POLICY "reimbursement_claims_insert" ON public.reimbursement_claims FOR INSERT TO authenticated
WITH CHECK (user_id::text = (SELECT auth.uid())::text OR public.check_user_role(ARRAY['admin', 'super_admin', 'finance', 'management']));

CREATE POLICY "reimbursement_claims_update" ON public.reimbursement_claims FOR UPDATE TO authenticated
USING ((user_id::text = (SELECT auth.uid())::text AND status = 'draft') OR public.check_user_role(ARRAY['admin', 'super_admin', 'finance', 'management']))
WITH CHECK ((user_id::text = (SELECT auth.uid())::text AND status IN ('draft', 'pending')) OR public.check_user_role(ARRAY['admin', 'super_admin', 'finance', 'management']));

-- K. security_audit_logs (uses user_id)
ALTER TABLE IF EXISTS public.security_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert security logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Only admins can view security logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "security_audit_logs_select" ON public.security_audit_logs;
DROP POLICY IF EXISTS "security_audit_logs_insert" ON public.security_audit_logs;

CREATE POLICY "security_audit_logs_select" ON public.security_audit_logs FOR SELECT TO authenticated
USING (public.check_user_role(ARRAY['admin', 'super_admin', 'security_auditor', 'developer']));

CREATE POLICY "security_audit_logs_insert" ON public.security_audit_logs FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) IS NOT NULL);


-- ----------------------------------------------------------------------------
-- 4. REVOKE PUBLIC/ANON EXPOSURE FOR SENSITIVE OBJECTS
-- ----------------------------------------------------------------------------

REVOKE ALL ON public.security_audit_logs FROM anon;
REVOKE ALL ON public.payroll_snapshots FROM anon;
REVOKE ALL ON public.reimbursement_claims FROM anon;
REVOKE ALL ON public.document_expiry_vault FROM anon;
REVOKE ALL ON public.billing_configs FROM anon;
REVOKE ALL ON public.email_logs FROM anon;
REVOKE ALL ON public.api_rate_limits FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reimbursement_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_expiry_vault TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_rate_limits TO authenticated;
