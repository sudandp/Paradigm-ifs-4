-- Migration: Laptop Device Binding & Work Application Usage Tracking
-- Description: Enforces 1-laptop-to-1-user exclusive binding and tracks active application productivity during shifts

-- =====================================================
-- 1. EXTEND user_devices FOR 1:1 HARDWARE BINDING
-- =====================================================

ALTER TABLE public.user_devices 
ADD COLUMN IF NOT EXISTS hardware_uuid TEXT,
ADD COLUMN IF NOT EXISTS is_exclusive_laptop BOOLEAN DEFAULT true;

-- Unique index to strictly ensure 1 laptop (hardware_uuid) cannot be registered to multiple users simultaneously
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_exclusive_hardware_uuid 
ON public.user_devices (hardware_uuid) 
WHERE (hardware_uuid IS NOT NULL AND status != 'revoked');

-- =====================================================
-- 2. CREATE laptop_app_usage_logs TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.laptop_app_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.user_devices(id) ON DELETE SET NULL,
    attendance_event_id UUID REFERENCES public.attendance_events(id) ON DELETE SET NULL,
    app_name TEXT NOT NULL,                  -- e.g. "Code.exe", "chrome.exe", "slack.exe"
    app_title TEXT,                          -- Active window title
    category TEXT NOT NULL DEFAULT 'other',  -- 'development', 'browsing', 'collaboration', 'other'
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    is_idle BOOLEAN DEFAULT false,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_laptop_app_usage_user_date 
ON public.laptop_app_usage_logs (user_id, session_date);

CREATE INDEX IF NOT EXISTS idx_laptop_app_usage_device 
ON public.laptop_app_usage_logs (device_id);

-- =====================================================
-- 3. CREATE daily_laptop_productivity_summary TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.daily_laptop_productivity_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_active_seconds INTEGER DEFAULT 0,
    total_idle_seconds INTEGER DEFAULT 0,
    top_apps JSONB DEFAULT '[]'::jsonb,
    categories_breakdown JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_productivity_user_date 
ON public.daily_laptop_productivity_summary (user_id, session_date DESC);

-- =====================================================
-- 4. RLS POLICIES & PERMISSIONS
-- =====================================================

ALTER TABLE public.laptop_app_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_laptop_productivity_summary ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.laptop_app_usage_logs TO authenticated;
GRANT ALL ON public.laptop_app_usage_logs TO service_role;
GRANT ALL ON public.daily_laptop_productivity_summary TO authenticated;
GRANT ALL ON public.daily_laptop_productivity_summary TO service_role;

-- Employees view own logs, Admins/Managers view all
DROP POLICY IF EXISTS "Users can view own laptop app logs" ON public.laptop_app_usage_logs;
CREATE POLICY "Users can view own laptop app logs" 
ON public.laptop_app_usage_logs FOR SELECT 
TO authenticated 
USING (
    user_id = auth.uid() 
    OR public.check_is_admin()
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'management', 'developer', 'hr')
    )
);

DROP POLICY IF EXISTS "Users can insert own laptop app logs" ON public.laptop_app_usage_logs;
CREATE POLICY "Users can insert own laptop app logs" 
ON public.laptop_app_usage_logs FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid() OR public.check_is_admin());

DROP POLICY IF EXISTS "Users can view own daily productivity summary" ON public.daily_laptop_productivity_summary;
CREATE POLICY "Users can view own daily productivity summary" 
ON public.daily_laptop_productivity_summary FOR SELECT 
TO authenticated 
USING (
    user_id = auth.uid() 
    OR public.check_is_admin()
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'management', 'developer', 'hr')
    )
);

DROP POLICY IF EXISTS "Users can insert/update own daily productivity summary" ON public.daily_laptop_productivity_summary;
CREATE POLICY "Users can insert/update own daily productivity summary" 
ON public.daily_laptop_productivity_summary FOR ALL 
TO authenticated 
USING (
    user_id = auth.uid() 
    OR public.check_is_admin()
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'management', 'developer', 'hr')
    )
)
WITH CHECK (
    user_id = auth.uid() 
    OR public.check_is_admin()
    OR EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'management', 'developer', 'hr')
    )
);
