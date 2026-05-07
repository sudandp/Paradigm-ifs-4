-- Kiosk Role & Auto-User Linking Migration
-- Pre-requisite: Run add_kiosk_device_id.sql first

-- 1. Insert "kiosk" role with zero permissions
INSERT INTO public.roles (id, display_name, permissions)
VALUES ('kiosk', 'Kiosk', '{}'::text[])
ON CONFLICT (id) DO NOTHING;

-- 2. Add user_id column to kiosk_devices (links device → auto-created user account)
ALTER TABLE public.kiosk_devices
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id);

-- 3. Create app_config table if it doesn't exist and add kiosk_admin_pin
CREATE TABLE IF NOT EXISTS public.app_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and allow read access
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'app_config' AND policyname = 'Allow public read access to app_config'
    ) THEN
        CREATE POLICY "Allow public read access to app_config" ON public.app_config FOR SELECT USING (true);
    END IF;
END
$$;

INSERT INTO public.app_config (config_key, config_value)
VALUES ('kiosk_admin_pin', '1234')
ON CONFLICT (config_key) DO NOTHING;
