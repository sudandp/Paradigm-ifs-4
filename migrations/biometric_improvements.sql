-- Biometric System Improvements - Database Migration
-- Run this in Supabase SQL Editor
-- Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS)

-- 1. Multi-descriptor support (Phase 2.3 - future use)
-- Stores multiple 128-d arrays for improved matching accuracy
ALTER TABLE gate_users ADD COLUMN IF NOT EXISTS face_descriptors JSONB;

-- 2. Descriptor metadata tracking
ALTER TABLE gate_users ADD COLUMN IF NOT EXISTS descriptor_version INTEGER DEFAULT 1;
ALTER TABLE gate_users ADD COLUMN IF NOT EXISTS descriptor_updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Registration audit trail
ALTER TABLE gate_users ADD COLUMN IF NOT EXISTS registered_by UUID;
ALTER TABLE gate_users ADD COLUMN IF NOT EXISTS registered_via TEXT DEFAULT 'admin';
-- Values: 'admin', 'self', 'kiosk'

-- 4. Expand allowed attendance methods to include passcode + registration events
ALTER TABLE gate_attendance_logs DROP CONSTRAINT IF EXISTS gate_attendance_logs_method_check;
ALTER TABLE gate_attendance_logs ADD CONSTRAINT gate_attendance_logs_method_check
  CHECK (method IN ('face', 'qr', 'manual', 'passcode', 'registration'));

-- 5. Performance index for delta sync
CREATE INDEX IF NOT EXISTS idx_gate_users_updated_at 
  ON gate_users(updated_at DESC) WHERE is_active = TRUE;

-- 6. Enable Realtime for gate_users (required for instant kiosk sync)
ALTER PUBLICATION supabase_realtime ADD TABLE gate_users;
