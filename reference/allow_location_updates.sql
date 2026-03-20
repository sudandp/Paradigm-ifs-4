-- Enable RLS on locations table
ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;

-- Drop potential conflicting update policies
DROP POLICY IF EXISTS "Enable update for users based on email" ON "public"."locations";
DROP POLICY IF EXISTS "Enable update for admins" ON "public"."locations";
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON "public"."locations";

-- Create policy to allow ALL authenticated users to UPDATE locations
-- This allows users to edit location names as requested
CREATE POLICY "Enable update for all authenticated users"
ON "public"."locations"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
