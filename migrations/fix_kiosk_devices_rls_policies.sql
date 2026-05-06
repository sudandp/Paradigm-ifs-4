-- Migration to fix Kiosk Devices RLS policies for anonymous public upsert (heartbeat reporting)
-- Standard "FOR ALL USING (true)" can fail on anonymous INSERT operations without explicit WITH CHECK rules.

-- 1. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "kiosk_devices_select_all" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_all_all" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_insert_all" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_update_all" ON public.kiosk_devices;

-- 2. Create dedicated, robust policies for SELECT, INSERT, and UPDATE
CREATE POLICY "kiosk_devices_select_all" ON public.kiosk_devices 
  FOR SELECT USING (true);

CREATE POLICY "kiosk_devices_insert_all" ON public.kiosk_devices 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "kiosk_devices_update_all" ON public.kiosk_devices 
  FOR UPDATE USING (true) WITH CHECK (true);
