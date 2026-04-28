-- Fix 1: Allow target users to also set status to 'failed' (not just 'successful')
DROP POLICY IF EXISTS "Users can update their own tracking status" ON tracking_audit_logs;

CREATE POLICY "Users can update their own tracking status"
ON tracking_audit_logs FOR UPDATE
TO authenticated
USING (target_user_id = auth.uid())
WITH CHECK (target_user_id = auth.uid() AND status IN ('successful', 'failed'));

-- Fix 2: Allow the anon role to update status by request_id
-- (Background FCM service doesn't have an auth session but knows the requestId)
DROP POLICY IF EXISTS "Anon can update tracking status by request_id" ON tracking_audit_logs;

CREATE POLICY "Anon can update tracking status by request_id"
ON tracking_audit_logs FOR UPDATE
TO anon
USING (true)
WITH CHECK (status IN ('successful', 'failed'));
