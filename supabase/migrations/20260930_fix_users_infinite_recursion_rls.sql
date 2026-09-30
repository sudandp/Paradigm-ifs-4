-- Migration: 20260930_fix_users_infinite_recursion_rls.sql
-- Description: Drop recursive self-referencing subquery policies on public.users that cause 
-- "infinite recursion detected in policy for relation users" (PostgreSQL error 42P17).

DROP POLICY IF EXISTS "Admin roles can update users - extended" ON public.users;
DROP POLICY IF EXISTS "Admin roles can insert users - extended" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile - extended" ON public.users;

-- Ensure public.users has the clean, non-recursive policies:
-- 1. users_select_all_authenticated: All authenticated users can read users profile info.
-- 2. users_insert_policy: Admins can insert new users via SECURITY DEFINER check_is_admin().
-- 3. users_update_policy: Admins can update any user, or users can update their own row.
-- 4. Managers can update team users: Managers can update rows where they are L1/L2/L3 manager.
-- 5. users_delete_policy: Admins can delete users.
