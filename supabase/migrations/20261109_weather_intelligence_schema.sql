-- ==============================================================================
-- Paradigm IFS - Weather Intelligence & Alert Engine Schema
-- Tables: weather_alerts, weather_tasks, weather_preferences
-- Realtime: Enabled for instant team synchronization
-- ==============================================================================

-- 1. Weather Alerts Table
CREATE TABLE IF NOT EXISTS public.weather_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID, -- Optional reference to locations(id)
    city_name TEXT NOT NULL DEFAULT 'Pune Site Cluster',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    alert_type TEXT NOT NULL, -- RAIN_IMMIGRANT, HEAVY_DOWNPOUR, HIGH_WIND, HEATWAVE, HIGH_UV, FOG
    severity TEXT NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    timing TEXT,
    weather_snapshot JSONB,
    triggered_at TIMESTAMPTZ DEFAULT now(),
    acknowledged_by UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying active site alerts
CREATE INDEX IF NOT EXISTS idx_weather_alerts_site ON public.weather_alerts(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_created_at ON public.weather_alerts(created_at DESC);

-- 2. Weather Tasks Table (Auto-generated facilities & safety checklist)
CREATE TABLE IF NOT EXISTS public.weather_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES public.weather_alerts(id) ON DELETE CASCADE,
    site_id UUID, -- Optional reference to locations(id)
    task_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'FACILITIES', -- FACILITIES, ELECTRICAL, SECURITY, SAFETY
    urgency TEXT NOT NULL DEFAULT 'NORMAL', -- NORMAL, HIGH, CRITICAL
    description TEXT,
    suggested_role TEXT,
    assigned_to UUID,
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, SKIPPED
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    completion_notes TEXT,
    action_code TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast status queries
CREATE INDEX IF NOT EXISTS idx_weather_tasks_status ON public.weather_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_tasks_site ON public.weather_tasks(site_id, status);

-- 3. Weather Preferences Table (User-level notification settings)
CREATE TABLE IF NOT EXISTS public.weather_preferences (
    user_id UUID PRIMARY KEY,
    enable_morning_brief BOOLEAN DEFAULT true,
    enable_travel_index BOOLEAN DEFAULT true,
    enable_rain_push BOOLEAN DEFAULT true,
    rain_alert_threshold INT DEFAULT 50, -- % probability
    preferred_station TEXT DEFAULT 'Pune (Head Office)',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.weather_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can view and update alerts and tasks
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can view weather alerts" ON public.weather_alerts;
    CREATE POLICY "Authenticated users can view weather alerts"
        ON public.weather_alerts FOR SELECT
        TO authenticated
        USING (true);

    DROP POLICY IF EXISTS "Authenticated users can insert weather alerts" ON public.weather_alerts;
    CREATE POLICY "Authenticated users can insert weather alerts"
        ON public.weather_alerts FOR INSERT
        TO authenticated
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users can update weather alerts" ON public.weather_alerts;
    CREATE POLICY "Authenticated users can update weather alerts"
        ON public.weather_alerts FOR UPDATE
        TO authenticated
        USING (true);

    DROP POLICY IF EXISTS "Authenticated users can view weather tasks" ON public.weather_tasks;
    CREATE POLICY "Authenticated users can view weather tasks"
        ON public.weather_tasks FOR SELECT
        TO authenticated
        USING (true);

    DROP POLICY IF EXISTS "Authenticated users can insert weather tasks" ON public.weather_tasks;
    CREATE POLICY "Authenticated users can insert weather tasks"
        ON public.weather_tasks FOR INSERT
        TO authenticated
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Authenticated users can update weather tasks" ON public.weather_tasks;
    CREATE POLICY "Authenticated users can update weather tasks"
        ON public.weather_tasks FOR UPDATE
        TO authenticated
        USING (true);

    DROP POLICY IF EXISTS "Authenticated users can manage weather preferences" ON public.weather_preferences;
    CREATE POLICY "Authenticated users can manage weather preferences"
        ON public.weather_preferences FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
END $$;

-- Enable Supabase Realtime for weather_alerts and weather_tasks
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.weather_alerts;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.weather_tasks;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;
