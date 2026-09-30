-- Migration: Automatically reassign pending leave requests on reporting manager change
-- Date: 2026-09-30

-- 1. Create or replace the trigger function on users to automatically reassign pending leave requests when reporting_manager_id changes
CREATE OR REPLACE FUNCTION public.handle_user_reporting_manager_change()
RETURNS trigger AS $$
BEGIN
    IF (OLD.reporting_manager_id IS DISTINCT FROM NEW.reporting_manager_id) THEN
        -- Reassign all pending leave requests for this user to their new manager
        UPDATE public.leave_requests
        SET current_approver_id = NEW.reporting_manager_id,
            updated_at = NOW()
        WHERE user_id = NEW.id
          AND status IN ('pending_manager_approval', 'pending_admin_correction');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to users table
DROP TRIGGER IF EXISTS trg_user_reporting_manager_change ON public.users;
CREATE TRIGGER trg_user_reporting_manager_change
    AFTER UPDATE OF reporting_manager_id ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_user_reporting_manager_change();

-- 3. Backfill all existing pending leave requests where current_approver_id differs from the employee's current reporting_manager_id
UPDATE public.leave_requests lr
SET current_approver_id = u.reporting_manager_id,
    updated_at = NOW()
FROM public.users u
WHERE lr.user_id = u.id
  AND u.reporting_manager_id IS NOT NULL
  AND (lr.current_approver_id IS DISTINCT FROM u.reporting_manager_id)
  AND lr.status IN ('pending_manager_approval', 'pending_admin_correction');
