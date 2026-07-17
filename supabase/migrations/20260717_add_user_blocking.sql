-- Migration: Add user blocking feature
-- Description: Adds is_blocked column to public.users and creates the block_user RPC to ban users in both auth and public tables.

-- 1. Add is_blocked column to public.users if not exists
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- 2. Create RPC function to block/unblock users in both public.users and auth.users
CREATE OR REPLACE FUNCTION block_user(target_user_id uuid, block_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Guard: Only users with 'manage_users' permission or admin/super_admin/developer roles can block users
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
    RAISE EXCEPTION 'Access denied: Only admins can block users.';
  END IF;

  -- Safety: Prevent self-blocking
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot block your own account.';
  END IF;

  -- 1. Update public.users
  UPDATE public.users 
  SET is_blocked = block_status 
  WHERE id = target_user_id;

  -- 2. Update auth.users to block/unblock login session (banned_until)
  IF block_status THEN
    UPDATE auth.users 
    SET banned_until = '2999-12-31 00:00:00+00' 
    WHERE id = target_user_id;
  ELSE
    UPDATE auth.users 
    SET banned_until = NULL 
    WHERE id = target_user_id;
  END IF;
END;
$$;
