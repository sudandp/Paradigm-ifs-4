-- Migration: Fix User Management RLS Policies
-- Date: 2026-01-05
-- Objective: Allow administrators to manage users and view notifications for others.

-- 1. Helper function to check for admin/HR roles without recursion
-- Using SECURITY DEFINER allows this function to bypass RLS when checking the requester's role.
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role_id IN ('admin', 'hr', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Users table policies
DO $$
BEGIN
    -- Drop existing policies that cause recursion
    DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
    DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
    DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
    DROP POLICY IF EXISTS "Admins can delete all users" ON public.users;

    -- Recreate policies using the recursion fix
    CREATE POLICY "Admins can view all users" ON public.users
        FOR SELECT
        USING (public.check_is_admin());

    CREATE POLICY "Admins can insert users" ON public.users
        FOR INSERT
        WITH CHECK (public.check_is_admin());

    CREATE POLICY "Admins can update all users" ON public.users
        FOR UPDATE
        USING (public.check_is_admin());

    CREATE POLICY "Admins can delete all users" ON public.users
        FOR DELETE
        USING (public.check_is_admin());
END $$;

-- 3. Notifications table policies
DO $$
BEGIN
    -- Drop existing policy if it causes recursion
    DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;

    -- Recreate policy using search-path safe recursion fix
    CREATE POLICY "Admins can view all notifications" ON public.notifications
        FOR SELECT
        USING (public.check_is_admin());
END $$;

-- 3. Fix Foreign Key Constraints for User Deletion
-- Change support_tickets FKs from NO ACTION to SET NULL to avoid 409 Conflict
DO $$
BEGIN
    -- Fix for raised_by_id
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_tickets_raised_by_id_fkey' AND table_name = 'support_tickets') THEN
        ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_raised_by_id_fkey;
        ALTER TABLE public.support_tickets 
            ADD CONSTRAINT support_tickets_raised_by_id_fkey 
            FOREIGN KEY (raised_by_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    -- Fix for assigned_to_id
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_tickets_assigned_to_id_fkey' AND table_name = 'support_tickets') THEN
        ALTER TABLE public.support_tickets DROP CONSTRAINT support_tickets_assigned_to_id_fkey;
        ALTER TABLE public.support_tickets 
            ADD CONSTRAINT support_tickets_assigned_to_id_fkey 
            FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Fix Attendance Approvals Manager FK
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_approvals_manager_id_fkey' AND table_name = 'attendance_approvals') THEN
        ALTER TABLE public.attendance_approvals DROP CONSTRAINT attendance_approvals_manager_id_fkey;
        ALTER TABLE public.attendance_approvals 
            ADD CONSTRAINT attendance_approvals_manager_id_fkey 
            FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;
