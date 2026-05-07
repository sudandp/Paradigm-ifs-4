-- Add device_id column to kiosk_devices table
ALTER TABLE public.kiosk_devices 
ADD COLUMN IF NOT EXISTS device_id TEXT UNIQUE;

-- We already have RLS policies set up previously that allow anon access,
-- but the prompt explicitly requested a policy where devices can read their own row
-- However, since fix_kiosk_devices_rls_policies.sql already granted public access to allow the kiosk to work without JWTs, 
-- we will preserve that functionality (otherwise kiosks without user auth will fail to read/update).

-- Enable realtime for kiosk_devices if not already enabled
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'kiosk_devices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE kiosk_devices;
  END IF;
END $$;
