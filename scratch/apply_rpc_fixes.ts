import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sql = `
-- 1. Update delete_user function
CREATE OR REPLACE FUNCTION delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access denied: Only admins can delete users.';
  END IF;

  -- Safety: Prevent self-deletion
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account.';
  END IF;

  -- 1. Delete from public.users table first (FK-safe order)
  DELETE FROM public.users WHERE id = target_user_id;

  -- 2. Delete from auth.users to fully remove the account
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- 2. Update approve_user function
CREATE OR REPLACE FUNCTION approve_user(user_id uuid, role_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
  new_joining_date date;
BEGIN
  -- Check if the executing user has 'manage_users' permission or admin privileges
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

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access denied: Only admins can approve users.';
  END IF;

  -- 1. Confirm the user's email in auth.users
  -- This allows them to login without clicking the email link
  UPDATE auth.users
  SET email_confirmed_at = now(),
      updated_at = now()
  WHERE id = user_id;

  -- 2. Fetch or compute the joining date
  SELECT coalesce(joining_date, current_date)
  INTO new_joining_date
  FROM public.users
  WHERE id = user_id;

  -- 3. Update the user's role, joining date, and leave balance opening dates in public.users
  UPDATE public.users
  SET role_id = role_text,
      joining_date = new_joining_date,
      earned_leave_opening_date = coalesce(earned_leave_opening_date, new_joining_date),
      sick_leave_opening_date = coalesce(sick_leave_opening_date, new_joining_date),
      comp_off_opening_date = coalesce(comp_off_opening_date, new_joining_date),
      floating_leave_opening_date = coalesce(floating_leave_opening_date, new_joining_date),
      child_care_leave_opening_date = coalesce(child_care_leave_opening_date, new_joining_date),
      updated_at = now()
  WHERE id = user_id;
END;
$$;
`;

async function main() {
    console.log("Applying SQL migration for delete_user and approve_user functions...");
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
        console.error("Error applying SQL migration:", error);
    } else {
        console.log("SQL Migration applied successfully! The RPC functions are now updated.");
    }
}

main().catch(console.error);
