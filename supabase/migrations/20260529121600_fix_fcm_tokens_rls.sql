-- Migration: Fix FCM tokens RLS policies to allow token upserts
-- Problem: When a new user logs in on a device where the FCM token already exists in the database
-- under a different user_id, doing an upsert attempts to update the existing row. Because the existing
-- row has a different user_id, the UPDATE fails the pre-existing USING check (auth.uid() = user_id)
-- under RLS, throwing a "new row violates row-level security policy" error.
--
-- Solution: Split the ALL policy for fcm_tokens into separate SELECT, INSERT, UPDATE, and DELETE policies.
-- In the UPDATE policy, allow users to update any row (USING true), but force that the resulting row
-- must belong to them (WITH CHECK auth.uid() = user_id). This allows claiming existing device tokens
-- without violating security bounds.

-- Drop the old policies if they exist
DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can update tokens to own them" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.fcm_tokens;

-- Create individual policies to handle the upsert/claiming scenario securely
CREATE POLICY "Users can view their own tokens"
ON public.fcm_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
ON public.fcm_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow updating any token as long as it is being reassigned to the current authenticated user.
-- This enables users to claim a token (e.g. from an old session on the same device/browser) during upsert.
CREATE POLICY "Users can update tokens to own them"
ON public.fcm_tokens
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
ON public.fcm_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Grant view_referrals permission to the hr_recruitment role
-- This resolves the ProtectedRoute Access Denied error for users with this role
UPDATE public.roles
SET permissions = array_append(coalesce(permissions, '{}'::text[]), 'view_referrals')
WHERE id = 'hr_recruitment' AND NOT (coalesce(permissions, '{}'::text[]) @> ARRAY['view_referrals']);
