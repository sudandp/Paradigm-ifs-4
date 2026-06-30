-- Migration: Add home_address column to public.users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS home_address TEXT;

COMMENT ON COLUMN public.users.home_address IS
  'Home address for travel distance calculation and visual confirmation.';
