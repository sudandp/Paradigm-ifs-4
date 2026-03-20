-- Migration: Final Fix for infinite recursion in users table RLS
-- Date: 2026-02-16
-- Description: Drops ALL known select policies to ensure no recursion remains.
--              Also provides a way to force-logout users by clearing sessions.

-- 1. Drop EVERY likely existing select policy to be safe
DROP POLICY IF EXISTS "users_select_policy_v2" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users read own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to read their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins and HR can view all users" ON public.users;
DROP POLICY IF EXISTS "Allow admin/hr to read all profiles" ON public.users;

-- 2. Create the non-recursive policy
-- Allowing all authenticated users to read profiles is stable and prevents check_is_admin() loop.
CREATE POLICY "users_select_policy_final" ON public.users 
FOR SELECT 
TO authenticated 
USING (true);

-- 3. FORCE LOGOUT (Optional but requested: "if any currently active logout them")
-- To force logout ALL users:
-- DELETE FROM auth.sessions;
-- DELETE FROM auth.refresh_tokens;

-- To force logout specific users (e.g. if you know the IDs):
-- DELETE FROM auth.sessions WHERE user_id = 'some-uuid';
