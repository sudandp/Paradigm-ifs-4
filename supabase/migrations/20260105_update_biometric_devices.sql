-- Migration to add location_name for manual site assignment
ALTER TABLE public.biometric_devices 
ADD COLUMN IF NOT EXISTS location_name TEXT;

-- Update RLS if needed (existing admins can manage devices policy should cover this)
