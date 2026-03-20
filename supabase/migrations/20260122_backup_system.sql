-- Migration: Backup & Restoration System
-- Date: 2026-01-22
-- Description: Creates the system_backups table to track restoration points and snapshots.

-- 1. Create system_backups table
CREATE TABLE IF NOT EXISTS public.system_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    snapshot_path TEXT NOT NULL, -- Path in the 'backups' storage bucket
    size_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES public.users(id),
    status TEXT DEFAULT 'completed' -- 'completed', 'failed', 'restoring'
);

-- 2. Add RLS for backups
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage backups' AND tablename = 'system_backups' AND schemaname = 'public'
    ) THEN
        CREATE POLICY "Admins manage backups" ON public.system_backups
            FOR ALL USING (public.check_is_admin());
    END IF;
END $$;

-- 3. Add missing columns to settings table
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS address_settings JSONB;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS gemini_api_settings JSONB;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS perfios_api_settings JSONB;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS otp_settings JSONB;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS site_management_settings JSONB;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS notification_settings JSONB;

-- 4. Storage Bucket Configuration
-- Create the backups bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'backups', 'backups', false
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'backups'
);

-- Policies for the 'backups' bucket in storage.objects
-- Only administrators (checked via public.check_is_admin()) can manage snapshots.

DO $$
BEGIN
    -- 1. SELECT policy: Allow admins to view backups
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view backups' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Admins can view backups" ON storage.objects
            FOR SELECT TO authenticated
            USING (bucket_id = 'backups' AND public.check_is_admin());
    END IF;

    -- 2. INSERT policy: Allow admins to upload backups (Restoration Points)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can upload backups' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Admins can upload backups" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'backups' AND public.check_is_admin());
    END IF;

    -- 3. UPDATE policy: Allow admins to update backup metadata
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update backups' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Admins can update backups" ON storage.objects
            FOR UPDATE TO authenticated
            USING (bucket_id = 'backups' AND public.check_is_admin())
            WITH CHECK (bucket_id = 'backups' AND public.check_is_admin());
    END IF;

    -- 4. DELETE policy: Allow admins to delete old backups
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete backups' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Admins can delete backups" ON storage.objects
            FOR DELETE TO authenticated
            USING (bucket_id = 'backups' AND public.check_is_admin());
    END IF;
END $$;

-- 5. Helper RPC for Edge Function to list tables
CREATE OR REPLACE FUNCTION public.get_public_tables()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    table_list text[];
BEGIN
    SELECT array_agg(table_name::text)
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    INTO table_list;
    RETURN table_list;
END;
$$;

-- 6. CRON Setup (Requires pg_cron extension)
-- Note: This requires the pg_cron extension to be enabled in Supabase dashboard or via SQL.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the system-backup-manager Edge Function to run every hour.
-- The function itself will check if a backup is actually due based on its internal schedule logic.
-- Replace [PROJECT_REF] and [SERVICE_ROLE_KEY] placeholders if running manually, 
-- but Supabase usually handles the URL internally for Edge Functions.
-- For local/hosted consistency, we can use net.http_post if net extension is enabled, 
-- or use the standard cron.schedule with a curl command.

DO $$
BEGIN
    -- Remove old job if exists
    PERFORM cron.unschedule('system-automated-backup-check');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if doesn't exist
END $$;

SELECT cron.schedule(
    'system-automated-backup-check',
    '0 * * * *', -- Every hour at minute 0
    $$
    SELECT
      net.http_post(
        url:=(SELECT value FROM net.http_request_header WHERE key = 'host') || '/functions/v1/system-backup-manager',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || (SELECT value FROM net.http_request_header WHERE key = 'apikey') || '"}'::jsonb,
        body:='{}'::jsonb
      )
    $$
);

-- Note: The above net.http_post approach is one way. 
-- Alternatively, admins can simply use the Supabase Dashboard -> Project Settings -> Database -> Cron 
-- to schedule the HTTP request to the Edge Function.
