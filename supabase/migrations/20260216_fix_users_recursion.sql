-- Migration: Fix infinite recursion in users table RLS
-- Date: 2026-02-16
-- Description: The users_select_policy was calling check_is_admin(), which queries public.users, 
--              triggering the policy again in an infinite loop. This migration reverts to the 
--              previous stable state of allowing all authenticated users to read profiles.

-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "users_select_policy" ON public.users;

-- 2. Re-create it with a recursion-safe definition
-- Allowing all authenticated users to read profiles is the standard way to fix this
-- and was the previous stable state of the system before the Feb 14th change.
CREATE POLICY "users_select_policy" ON public.users 
FOR SELECT 
TO authenticated 
USING (true);

-- 3. The UPDATE/INSERT/DELETE policies still use check_is_admin(), 
-- but they will now work because the SELECT check (triggered by those checks) is no longer recursive.
