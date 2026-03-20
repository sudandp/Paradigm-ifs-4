-- Migration script to add gender column to users table
-- Run this in the Supabase SQL Editor

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS gender text;

-- Optional: Update the handle_new_auth_user function if you want to capture gender from metadata,
-- but typically gender is updated by the user in their profile later.
