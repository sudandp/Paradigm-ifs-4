-- migrations/create_user_vehicles.sql
-- Create user_vehicles table to store details of employee vehicles

CREATE TABLE IF NOT EXISTS public.user_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('two_wheeler', 'four_wheeler_petrol', 'four_wheeler_diesel', 'public_transport', 'company_vehicle')),
  brand_name TEXT NOT NULL,
  engine_cc INTEGER, -- Optional/Required for bike
  odometer_reading INTEGER NOT NULL,
  odometer_picture_url TEXT NOT NULL,
  status TEXT DEFAULT 'approved' CHECK (status IN ('approved', 'pending')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_vehicles ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS "Users can view their own vehicles" ON public.user_vehicles;
CREATE POLICY "Users can view their own vehicles" 
ON public.user_vehicles FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers and Admin can view all user vehicles" ON public.user_vehicles;
CREATE POLICY "Managers and Admin can view all user vehicles" 
ON public.user_vehicles FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND role_id IN ('admin', 'super_admin', 'developer', 'management', 'reporting_manager', 'hr')
  )
);

-- Insert policies
DROP POLICY IF EXISTS "Users can insert their own vehicles" ON public.user_vehicles;
CREATE POLICY "Users can insert their own vehicles" 
ON public.user_vehicles FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

-- Update/Delete policies
DROP POLICY IF EXISTS "Users can update their own vehicles" ON public.user_vehicles;
CREATE POLICY "Users can update their own vehicles" 
ON public.user_vehicles FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Managers and Admin can manage all vehicles" ON public.user_vehicles;
CREATE POLICY "Managers and Admin can manage all vehicles" 
ON public.user_vehicles FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND role_id IN ('admin', 'super_admin', 'developer', 'management', 'reporting_manager', 'hr')
  )
);
