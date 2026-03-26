-- Migration: Add Hierarchical User Fields
-- Date: 2026-03-26
-- Description: Adds society_id, society_name, and location_id to users table for hierarchical mapping.

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS society_id TEXT REFERENCES public.companies(id),
ADD COLUMN IF NOT EXISTS society_name TEXT,
ADD COLUMN IF NOT EXISTS location_id TEXT REFERENCES public.organization_groups(id);

-- Optional: Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_users_society_id ON public.users(society_id);
CREATE INDEX IF NOT EXISTS idx_users_location_id ON public.users(location_id);
