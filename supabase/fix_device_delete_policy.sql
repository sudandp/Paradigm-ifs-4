-- Fix for Device Deletion RLS Policies

-- 1. Check if policies exist and drop them to avoid conflicts
DROP POLICY IF EXISTS "user_devices_delete_own" ON public.user_devices;
DROP POLICY IF EXISTS "user_devices_delete_admin_hr" ON public.user_devices;

-- 2. Create policy to allow users to delete their own devices
CREATE POLICY "user_devices_delete_own" 
    ON public.user_devices 
    FOR DELETE 
    TO authenticated 
    USING (user_id = auth.uid());

-- 3. Create policy to allow Admins and HR to delete any device
CREATE POLICY "user_devices_delete_admin_hr" 
    ON public.user_devices 
    FOR DELETE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role_id IN ('admin', 'hr')
        )
    );

-- 4. Enable RLS on the table (just in case)
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
