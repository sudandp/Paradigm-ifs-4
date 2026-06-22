-- RPC: delete_user
-- Deletes a user from both public.users and auth.users in one atomic operation.
-- Must be run with SECURITY DEFINER so it can access auth.users.
-- Only admins can call this function.

CREATE OR REPLACE FUNCTION delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Guard: Only admin/super_admin roles can delete users
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role_id IN ('admin', 'super_admin', 'superadmin', 'developer')
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
