-- Migration to add biometric device support

-- 1. Create biometric_devices table
CREATE TABLE IF NOT EXISTS public.biometric_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sn TEXT UNIQUE NOT NULL, -- Serial Number
    name TEXT NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'offline',
    last_seen TIMESTAMPTZ,
    ip_address TEXT,
    port INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;

-- 2. Add biometric_id to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS biometric_id TEXT UNIQUE;

-- 3. Add device_id to attendance_events table
ALTER TABLE public.attendance_events ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES public.biometric_devices(id);

-- 4. Create RLS policies for biometric_devices
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE polname = 'Admins can manage biometric devices' AND tablename = 'biometric_devices'
    ) THEN
        CREATE POLICY "Admins can manage biometric devices"
            ON public.biometric_devices
            FOR ALL
            USING (EXISTS (
                SELECT 1 FROM public.users u 
                WHERE u.id = auth.uid() AND u.role_id IN ('admin', 'developer')
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE polname = 'Authenticated users can view devices' AND tablename = 'biometric_devices'
    ) THEN
        CREATE POLICY "Authenticated users can view devices"
            ON public.biometric_devices
            FOR SELECT
            USING (auth.role() = 'authenticated');
    END IF;
END$$;

-- 5. Add trigger for updated_at on biometric_devices
DROP TRIGGER IF EXISTS biometric_devices_set_updated_at ON public.biometric_devices;
CREATE TRIGGER biometric_devices_set_updated_at
BEFORE UPDATE ON public.biometric_devices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
