-- ==============================================================================
-- MIGRATION: 20261119_fix_delete_user_field_violations.sql
-- Fix: Prevent FK violation on field_attendance_violations when deleting users.
-- Recreates delete_user RPC to clean up field_attendance_violations,
-- field_reports, attendance_unlock_requests, and second_reporting_manager_id.
-- ==============================================================================

-- 1. Update foreign key constraints on field_attendance_violations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'field_attendance_violations_user_id_fkey'
  ) THEN
    ALTER TABLE public.field_attendance_violations DROP CONSTRAINT field_attendance_violations_user_id_fkey;
  END IF;

  ALTER TABLE public.field_attendance_violations 
    ADD CONSTRAINT field_attendance_violations_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'field_attendance_violations_acknowledged_by_fkey'
  ) THEN
    ALTER TABLE public.field_attendance_violations DROP CONSTRAINT field_attendance_violations_acknowledged_by_fkey;
  END IF;

  ALTER TABLE public.field_attendance_violations 
    ADD CONSTRAINT field_attendance_violations_acknowledged_by_fkey 
    FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE SET NULL;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'field_attendance_violations_escalated_to_fkey'
  ) THEN
    ALTER TABLE public.field_attendance_violations DROP CONSTRAINT field_attendance_violations_escalated_to_fkey;
  END IF;

  ALTER TABLE public.field_attendance_violations 
    ADD CONSTRAINT field_attendance_violations_escalated_to_fkey 
    FOREIGN KEY (escalated_to) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Add DELETE policy on field_attendance_violations for admins
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can delete violations" ON public.field_attendance_violations;
  CREATE POLICY "Admins can delete violations"
    ON public.field_attendance_violations FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role_id IN ('admin', 'super_admin', 'superadmin', 'developer')
      )
    );
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Update delete_user RPC Function
CREATE OR REPLACE FUNCTION delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  is_admin boolean;
  target_user_email text;
BEGIN
  -- Guard: Only users with 'manage_users' permission or admin/super_admin/developer roles can delete users
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    LEFT JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND (
        'manage_users' = ANY(r.permissions)
        OR u.role_id IN ('admin', 'super_admin', 'superadmin', 'developer')
      )
  ) INTO is_admin;

  -- Also allow service role / postgres / direct admin execution
  IF NOT is_admin AND auth.role() != 'service_role' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Access denied: Only admins can delete users.';
  END IF;

  -- Safety: Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account.';
  END IF;

  -- Get email for email-based table cleanups
  SELECT email INTO target_user_email FROM public.users WHERE id = target_user_id;

  -- =========================================================================
  -- 1. NULLIFY / CLEAN UP EXPLICIT FOREIGN KEY REFERENCES & CHILD RECORDS
  -- =========================================================================

  -- Field Staff Violations & Reports (CRITICAL FIX FOR FK VIOLATION)
  BEGIN
    DELETE FROM public.field_attendance_violations WHERE user_id = target_user_id;
    UPDATE public.field_attendance_violations SET acknowledged_by = NULL WHERE acknowledged_by = target_user_id;
    UPDATE public.field_attendance_violations SET escalated_to = NULL WHERE escalated_to = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.field_reports WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Attendance Unlock Requests
  BEGIN
    DELETE FROM public.attendance_unlock_requests WHERE user_id = target_user_id;
    UPDATE public.attendance_unlock_requests SET manager_id = NULL WHERE manager_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- System Backups
  BEGIN
    UPDATE public.system_backups SET created_by = NULL WHERE created_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Attendance Audit Logs
  BEGIN
    UPDATE public.attendance_audit_logs SET target_user_id = NULL WHERE target_user_id = target_user_id;
    UPDATE public.attendance_audit_logs SET performed_by = NULL WHERE performed_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Security & Audit Logs
  BEGIN
    UPDATE public.security_audit_logs SET user_id = NULL WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.audit_logs SET user_id = NULL WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.system_audit_logs SET user_id = NULL WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.tracking_audit_logs SET admin_id = NULL WHERE admin_id = target_user_id;
    UPDATE public.tracking_audit_logs SET target_user_id = NULL WHERE target_user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Reporting Manager References (including secondary)
  BEGIN
    UPDATE public.users SET reporting_manager_id = NULL WHERE reporting_manager_id = target_user_id;
    UPDATE public.users SET reporting_manager_2_id = NULL WHERE reporting_manager_2_id = target_user_id;
    UPDATE public.users SET reporting_manager_3_id = NULL WHERE reporting_manager_3_id = target_user_id;
    UPDATE public.users SET second_reporting_manager_id = NULL WHERE second_reporting_manager_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Gate passes & emergency alerts
  BEGIN
    UPDATE public.gate_emergency_alerts SET resolved_by = NULL WHERE resolved_by = target_user_id;
    UPDATE public.gate_material_passes SET noc_approved_by = NULL WHERE noc_approved_by = target_user_id;
    UPDATE public.gate_material_passes SET gate_verified_by = NULL WHERE gate_verified_by = target_user_id;
    UPDATE public.kiosk_devices SET user_id = NULL WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Support Tickets & Comments
  BEGIN
    UPDATE public.support_tickets SET assigned_to_id = NULL WHERE assigned_to_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.ticket_posts WHERE ticket_id IN (SELECT id FROM public.support_tickets WHERE raised_by_id = target_user_id);
    DELETE FROM public.ticket_comments WHERE ticket_id IN (SELECT id FROM public.support_tickets WHERE raised_by_id = target_user_id);
    DELETE FROM public.support_tickets WHERE raised_by_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.ticket_comments SET author_id = NULL WHERE author_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.ticket_posts SET author_id = NULL WHERE author_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Tasks
  BEGIN
    UPDATE public.tasks SET assigned_to_id = NULL WHERE assigned_to_id = target_user_id;
    UPDATE public.tasks SET created_by_id = NULL WHERE created_by_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Locations & Matrices
  BEGIN
    UPDATE public.locations SET created_by = NULL WHERE created_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.site_responsibility_matrix SET ops_manager_id = NULL WHERE ops_manager_id = target_user_id;
    UPDATE public.site_responsibility_matrix SET site_manager_id = NULL WHERE site_manager_id = target_user_id;
    UPDATE public.site_responsibility_matrix SET hr_incharge_id = NULL WHERE hr_incharge_id = target_user_id;
    UPDATE public.site_responsibility_matrix SET accounts_incharge_id = NULL WHERE accounts_incharge_id = target_user_id;
    UPDATE public.site_responsibility_matrix SET site_supervisor_id = NULL WHERE site_supervisor_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Referrals & CRM
  BEGIN
    UPDATE public.candidate_referrals SET created_by = NULL WHERE created_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.business_referrals SET created_by = NULL WHERE created_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.crm_leads SET assigned_to = NULL WHERE assigned_to = target_user_id;
    UPDATE public.crm_leads SET created_by = NULL WHERE created_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Site Finance & Invoicing
  BEGIN
    UPDATE public.site_invoice_tracker SET created_by = NULL WHERE created_by = target_user_id;
    UPDATE public.site_invoice_tracker SET deleted_by = NULL WHERE deleted_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.site_finance_tracker SET created_by = NULL WHERE created_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Onboarding submissions
  BEGIN
    DELETE FROM public.onboarding_submissions WHERE user_id = target_user_id;
    UPDATE public.onboarding_submissions SET created_user_id = NULL WHERE created_user_id = target_user_id;
    UPDATE public.onboarding_submissions SET verified_by = NULL WHERE verified_by = target_user_id;
    UPDATE public.onboarding_submissions SET fcu_acknowledged_by = NULL WHERE fcu_acknowledged_by = target_user_id;
    UPDATE public.onboarding_submissions SET fcu_verified_by = NULL WHERE fcu_verified_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Approvals & Logs
  BEGIN
    UPDATE public.attendance_approvals SET manager_id = NULL WHERE manager_id = target_user_id;
    DELETE FROM public.attendance_approvals WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.comp_off_logs SET granted_by_id = NULL WHERE granted_by_id = target_user_id;
    DELETE FROM public.comp_off_logs WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.extra_work_logs SET approver_id = NULL WHERE approver_id = target_user_id;
    DELETE FROM public.extra_work_logs WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Devices & User mappings
  BEGIN
    DELETE FROM public.user_devices WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.device_activity_logs WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.device_approvals WHERE user_id = target_user_id;
    UPDATE public.device_approvals SET approved_by_id = NULL WHERE approved_by_id = target_user_id;
    UPDATE public.device_approvals SET reviewed_by_id = NULL WHERE reviewed_by_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.device_reset_logs WHERE user_id = target_user_id;
    UPDATE public.device_reset_logs SET reset_by = NULL WHERE reset_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.user_locations WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.notifications WHERE user_id = target_user_id OR recipient_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.notification_rules WHERE recipient_user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.user_children WHERE user_id = target_user_id;
    UPDATE public.user_children SET verified_by = NULL WHERE verified_by = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.attendance_events WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.attendance_violations WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.leave_requests WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.user_documents WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.user_holidays WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.user_vehicles WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.gate_users WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.employee_scores WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.fcm_tokens WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.route_history WHERE user_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    DELETE FROM public.communication_logs WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF target_user_email IS NOT NULL THEN
    BEGIN
      DELETE FROM public.user_site_permissions WHERE user_email = target_user_email;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Ops / CRM references
  BEGIN
    UPDATE public.ops_tickets SET created_by = NULL WHERE created_by = target_user_id;
    UPDATE public.ops_tickets SET assigned_to = NULL WHERE assigned_to = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    UPDATE public.ops_approval_requests SET requested_by = NULL WHERE requested_by = target_user_id;
    UPDATE public.ops_approval_requests SET approver_id = NULL WHERE approver_id = target_user_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- =========================================================================
  -- 2. DELETE FROM public.users TABLE
  -- =========================================================================
  DELETE FROM public.users WHERE id = target_user_id;

  -- =========================================================================
  -- 3. DELETE FROM auth.users TABLE
  -- =========================================================================
  DELETE FROM auth.users WHERE id = target_user_id;

END;
$$;
