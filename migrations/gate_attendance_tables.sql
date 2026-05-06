-- Gate Attendance System - Database Schema
-- Creates the tables needed for face recognition, QR code, and manual gate attendance.

-- 1. Gate Users (registered faces and QR tokens)
CREATE TABLE IF NOT EXISTS gate_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  face_descriptor JSONB, -- 128-d float array from face-api.js
  qr_token TEXT UNIQUE NOT NULL,
  photo_url TEXT, -- Reference photo URL in Supabase Storage
  department TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for fast lookups by user_id and qr_token
CREATE INDEX IF NOT EXISTS idx_gate_users_user_id ON gate_users(user_id);
CREATE INDEX IF NOT EXISTS idx_gate_users_qr_token ON gate_users(qr_token);
CREATE INDEX IF NOT EXISTS idx_gate_users_active ON gate_users(is_active) WHERE is_active = TRUE;

-- 2. Gate Attendance Logs
CREATE TABLE IF NOT EXISTS gate_attendance_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gate_user_id UUID REFERENCES gate_users(id) ON DELETE SET NULL,
  method TEXT NOT NULL CHECK (method IN ('face', 'qr', 'manual')),
  confidence NUMERIC(5,4), -- Face match confidence (0.0000 - 1.0000)
  image_proof_url TEXT, -- Captured frame / photo proof stored in Supabase Storage
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  device_info JSONB, -- Browser UA, screen size etc.
  location JSONB, -- { latitude, longitude } if available
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_logs_user_id ON gate_attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_gate_logs_marked_at ON gate_attendance_logs(marked_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_logs_method ON gate_attendance_logs(method);

-- 3. RLS Policies
ALTER TABLE gate_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_attendance_logs ENABLE ROW LEVEL SECURITY;

-- Admin/HR can read all gate users
CREATE POLICY "gate_users_select_admin" ON gate_users
  FOR SELECT USING (true);

-- Admin/HR can insert/update gate users
CREATE POLICY "gate_users_insert_admin" ON gate_users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "gate_users_update_admin" ON gate_users
  FOR UPDATE USING (true);

-- Anyone can read attendance logs (for dashboard)
CREATE POLICY "gate_logs_select_all" ON gate_attendance_logs
  FOR SELECT USING (true);

-- Kiosk/Gate device can insert logs
CREATE POLICY "gate_logs_insert_all" ON gate_attendance_logs
  FOR INSERT WITH CHECK (true);
