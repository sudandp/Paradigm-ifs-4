-- 1. Fix 400 Error (Missing site_visits in field_attendance_violations)
ALTER TABLE public.field_attendance_violations 
ADD COLUMN IF NOT EXISTS site_visits integer DEFAULT 0;

-- 2. Fix 403 Error (RLS Insert policy for notifications)
-- First, ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert notifications for themselves or others (as triggered by system logic)
-- Note: In a production environment, you might want more restrictive policies, 
-- but for dispatching alerts, users need insert permission.
CREATE POLICY "Allow authenticated users to insert notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Also ensure users can see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" 
ON public.notifications 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Ensure users can update (mark as read) their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" 
ON public.notifications 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
