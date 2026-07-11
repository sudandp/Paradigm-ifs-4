-- Drop the existing insert policy that limits inserts to admins only
DROP POLICY IF EXISTS "attendance_violations_insert" ON public.attendance_violations;

-- Recreate the policy to allow admins OR the user themselves to insert violations
CREATE POLICY "attendance_violations_insert" ON public.attendance_violations 
FOR INSERT WITH CHECK (
    public.check_is_admin() OR user_id = auth.uid()
);
