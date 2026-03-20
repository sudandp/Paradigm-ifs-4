-- Fix RLS for automated_notification_rules to match the app's role structure

DROP POLICY IF EXISTS "Admins manage automated rules" ON public.automated_notification_rules;

CREATE POLICY "Admins manage automated rules" 
ON public.automated_notification_rules FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role_id IN ('admin', 'admin_id', 'management', 'management_id', 'super_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role_id IN ('admin', 'admin_id', 'management', 'management_id', 'super_admin')
    )
);
