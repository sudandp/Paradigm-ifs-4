-- Migration to add site-based kiosk pin to locations table
ALTER TABLE public.locations 
ADD COLUMN IF NOT EXISTS kiosk_pin TEXT DEFAULT '1234';

COMMENT ON COLUMN public.locations.kiosk_pin IS 'PIN used to unlock kiosk mode for this specific location';
