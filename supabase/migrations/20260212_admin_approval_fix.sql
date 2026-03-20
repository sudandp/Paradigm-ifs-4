-- Drop potentially conflicting or restrictive policies if they exist
DROP POLICY IF EXISTS "Admins have full access to unlock requests" ON public.attendance_unlock_requests;

-- Create a robust Admin policy (Case Insensitive)
CREATE POLICY "Admins have full access to unlock requests" 
ON public.attendance_unlock_requests FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() 
        AND LOWER(public.users.role_id) IN ('admin', 'management', 'hr', 'developer', 'super_admin')
    )
);

-- Ensure Managers can update team requests (explicit policy if needed, though they usually use the generic update policy)
-- This policy ensures that if you are the reporting manager, you can update the request (approve/reject).
-- Note: The existing policy might already cover this, but we ensure it's robust.
DROP POLICY IF EXISTS "Managers can update team requests" ON public.attendance_unlock_requests;

CREATE POLICY "Managers can update team requests" 
ON public.attendance_unlock_requests FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = public.attendance_unlock_requests.user_id 
        AND public.users.reporting_manager_id = auth.uid()
    )
);
