-- Migration: Add voip_settings column to settings table
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS voip_settings jsonb DEFAULT '{}'::jsonb;
