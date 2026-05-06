-- Migration to allow anonymous public/anonymous select access to locations table
-- This allows standalone/gate kiosk devices to fetch the site locations list for pairing.
DROP POLICY IF EXISTS "locations_public_select" ON public.locations;
CREATE POLICY "locations_public_select" ON public.locations FOR SELECT USING (true);
