-- ==============================================================================
-- MIGRATION: Fix User Deletion Foreign Key Constraints & Enhance delete_user RPC
-- Date: 2026-09-04
-- Solves: "update or delete on table users violates foreign key constraint"
-- ==============================================================================

-- 1. Fix foreign key constraints on security_audit_logs
DO $$
BEGIN
  -- Drop existing constraint if present
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'security_audit_logs_user_id_fkey'
  ) THEN
    ALTER TABLE public.security_audit_logs DROP CONSTRAINT security_audit_logs_user_id_fkey;
  END IF;

  -- Re-add with ON DELETE SET NULL
  ALTER TABLE public.security_audit_logs 
    ADD CONSTRAINT security_audit_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Fix foreign key constraints on audit_logs if any
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'audit_logs_user_id_fkey'
  ) THEN
    ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_user_id_fkey;
    ALTER TABLE public.audit_logs 
      ADD CONSTRAINT audit_logs_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 3. Fix foreign key constraints on support_tickets
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'support_tickets_assigned_to_id_fkey'
  ) THEN
    ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_assigned_to_id_fkey;
    ALTER TABLE public.support_tickets 
      ADD CONSTRAINT support_tickets_assigned_to_id_fkey 
      FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'support_tickets_raised_by_id_fkey'
  ) THEN
    ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_raised_by_id_fkey;
    ALTER TABLE public.support_tickets 
      ADD CONSTRAINT support_tickets_raised_by_id_fkey 
      FOREIGN KEY (raised_by_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. Recreate delete_user RPC Function with pre-cleanup
CREATE OR REPLACE FUNCTION delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  is_admin boolean;
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

  -- Also allow service role / direct admin execution
  IF NOT is_admin AND auth.role() != 'service_role' AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Access denied: Only admins can delete users.';
  END IF;

  -- Safety: Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account.';
  END IF;

  -- =========================================================================
  -- 1. NULLIFY / CLEAN UP EXPLICIT FOREIGN KEY REFERENCES
  -- =========================================================================
  
  -- Security & Audit Logs
  BEGIN
    UPDATE public.security_audit_logs SET user_id = NULL WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.audit_logs SET user_id = NULL WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.system_audit_logs SET user_id = NULL WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.tracking_audit_logs SET admin_id = NULL WHERE admin_id = target_user_id;
    UPDATE public.tracking_audit_logs SET target_user_id = NULL WHERE target_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Self-referencing reporting manager
  BEGIN
    UPDATE public.users SET reporting_manager_id = NULL WHERE reporting_manager_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Support Tickets & Comments
  BEGIN
    UPDATE public.support_tickets SET assigned_to_id = NULL WHERE assigned_to_id = target_user_id;
    UPDATE public.support_tickets SET raised_by_id = NULL WHERE raised_by_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.ticket_comments SET author_id = NULL WHERE author_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.ticket_posts SET author_id = NULL WHERE author_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Tasks
  BEGIN
    UPDATE public.tasks SET assigned_to_id = NULL WHERE assigned_to_id = target_user_id;
    UPDATE public.tasks SET created_by_id = NULL WHERE created_by_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Locations & Matrices
  BEGIN
    UPDATE public.locations SET created_by = NULL WHERE created_by = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.site_responsibility_matrix SET ops_manager_id = NULL WHERE ops_manager_id = target_user_id;
    UPDATE public.site_responsibility_matrix SET hr_incharge_id = NULL WHERE hr_incharge_id = target_user_id;
    UPDATE public.site_responsibility_matrix SET accounts_incharge_id = NULL WHERE accounts_incharge_id = target_user_id;
    UPDATE public.site_responsibility_matrix SET site_supervisor_id = NULL WHERE site_supervisor_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Onboarding submissions
  BEGIN
    UPDATE public.onboarding_submissions SET user_id = NULL WHERE user_id = target_user_id;
    UPDATE public.onboarding_submissions SET created_user_id = NULL WHERE created_user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Approvals & Logs
  BEGIN
    UPDATE public.attendance_approvals SET manager_id = NULL WHERE manager_id = target_user_id;
    DELETE FROM public.attendance_approvals WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.comp_off_logs SET granted_by_id = NULL WHERE granted_by_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.extra_work_logs SET approver_id = NULL WHERE approver_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Devices & User mappings
  BEGIN
    DELETE FROM public.user_devices WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.device_approvals WHERE user_id = target_user_id;
    UPDATE public.device_approvals SET approved_by_id = NULL WHERE approved_by_id = target_user_id;
    UPDATE public.device_approvals SET reviewed_by_id = NULL WHERE reviewed_by_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.device_reset_logs WHERE user_id = target_user_id;
    UPDATE public.device_reset_logs SET reset_by = NULL WHERE reset_by = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.user_locations WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.notifications WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.attendance_events WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.leave_requests WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.comp_off_logs WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.extra_work_logs WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.employee_scores WHERE user_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    DELETE FROM public.communication_logs WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  -- Ops / CRM references
  BEGIN
    UPDATE public.ops_tickets SET created_by = NULL WHERE created_by = target_user_id;
    UPDATE public.ops_tickets SET assigned_to = NULL WHERE assigned_to = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.ops_approval_requests SET requester_id = NULL WHERE requester_id = target_user_id;
    UPDATE public.ops_approval_requests SET approver_id = NULL WHERE approver_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;

  BEGIN
    UPDATE public.crm_leads SET assigned_to_id = NULL WHERE assigned_to_id = target_user_id;
    UPDATE public.crm_leads SET created_by_id = NULL WHERE created_by_id = target_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
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
