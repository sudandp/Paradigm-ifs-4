-- Migration to add Kiosk Device Management and Telemetry tables
CREATE TABLE IF NOT EXISTS public.kiosk_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL, -- e.g., 'Samsung M07 - Gate 1'
  device_model TEXT DEFAULT 'Samsung M07',
  ip_address TEXT,
  battery_percentage INT,
  signal_strength TEXT, -- e.g., 'Excellent', 'Good', 'Poor' or Downlink MB/s
  is_active BOOLEAN DEFAULT TRUE,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id)
);

-- Index for real-time status checking
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_location ON kiosk_devices(location_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_devices_heartbeat ON kiosk_devices(last_heartbeat DESC);

-- Enable RLS
ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent duplication conflicts
DROP POLICY IF EXISTS "kiosk_devices_select_all" ON public.kiosk_devices;
DROP POLICY IF EXISTS "kiosk_devices_all_all" ON public.kiosk_devices;

-- Create RLS Policies
CREATE POLICY "kiosk_devices_select_all" ON public.kiosk_devices FOR SELECT USING (true);
CREATE POLICY "kiosk_devices_all_all" ON public.kiosk_devices FOR ALL USING (true);
