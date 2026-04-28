-- Add telemetry columns to route_history
ALTER TABLE route_history
ADD COLUMN IF NOT EXISTS battery_level NUMERIC,
ADD COLUMN IF NOT EXISTS device_name TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS network_type TEXT,
ADD COLUMN IF NOT EXISTS network_provider TEXT;

-- Add telemetry columns to attendance_events
ALTER TABLE attendance_events
ADD COLUMN IF NOT EXISTS battery_level NUMERIC,
ADD COLUMN IF NOT EXISTS device_name TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS network_type TEXT,
ADD COLUMN IF NOT EXISTS network_provider TEXT;

-- Update RLS if needed (usually route_history is already set up)
