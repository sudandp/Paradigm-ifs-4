-- Fix: Add missing DELETE policy for gate_users table
-- Without this, the Supabase client cannot delete gate_users records due to RLS.
-- Run this in Supabase SQL Editor.

CREATE POLICY "gate_users_delete_admin" ON gate_users
  FOR DELETE USING (true);
