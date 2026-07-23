-- ============================================================================
-- PHASE 1 CRITICAL FIXES: Supabase Postgres RLS, Permissions & Schema Mismatches
-- Paradigm Office 4 — Database Stabilization Script
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIX NOTIFICATIONS RLS & PERMISSIONS (Resolves 403 error on notification insert)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated and service roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

-- Ensure columns exist (user_id / recipient_id alias support)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'recipient_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
            ALTER TABLE public.notifications ADD COLUMN recipient_id UUID REFERENCES public.users(id);
            UPDATE public.notifications SET recipient_id = user_id WHERE recipient_id IS NULL;
        ELSE
            ALTER TABLE public.notifications ADD COLUMN recipient_id UUID REFERENCES public.users(id);
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'user_id') THEN
        ALTER TABLE public.notifications ADD COLUMN user_id UUID REFERENCES public.users(id);
        UPDATE public.notifications SET user_id = recipient_id WHERE user_id IS NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'created_at') THEN
        ALTER TABLE public.notifications ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'title') THEN
        ALTER TABLE public.notifications ADD COLUMN title TEXT;
    END IF;
END $$;

-- Drop obsolete or restrictive policies
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

-- Create permissive INSERT policy for authenticated users / system tasks
CREATE POLICY "Allow authenticated users to insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create SELECT policy for users to see notifications sent to them
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR 
    auth.uid() = recipient_id OR
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

-- Create UPDATE policy (e.g. marking notifications as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = recipient_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = recipient_id);


-- ----------------------------------------------------------------------------
-- 2. FIX ROUTE_HISTORY PERMISSIONS & RLS (Resolves 401 & 403 errors on /rest/v1/route_history)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.route_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    battery_level NUMERIC,
    device_name TEXT,
    ip_address TEXT,
    network_type TEXT,
    network_provider TEXT,
    source TEXT,
    request_id TEXT
);

-- Ensure permissions are explicitly granted
GRANT ALL ON public.route_history TO authenticated;
GRANT ALL ON public.route_history TO service_role;

ALTER TABLE public.route_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own route points" ON public.route_history;
DROP POLICY IF EXISTS "Users can view their own route points" ON public.route_history;
DROP POLICY IF EXISTS "Managers and Admin can view all route points" ON public.route_history;
DROP POLICY IF EXISTS "Allow route history insert for authenticated" ON public.route_history;

CREATE POLICY "Allow route history insert for authenticated"
ON public.route_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their own route points"
ON public.route_history
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'reporting_manager', 'hr')
    )
);


-- ----------------------------------------------------------------------------
-- 3. FIX TRAVEL_LOGS MISSING COLUMNS (Resolves column "total_km" does not exist)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.travel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    travel_date DATE NOT NULL,
    vehicle_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_travel_date UNIQUE (user_id, travel_date)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_logs' AND column_name = 'total_km') THEN
        ALTER TABLE public.travel_logs ADD COLUMN total_km NUMERIC(10, 3) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_logs' AND column_name = 'deduction_km') THEN
        ALTER TABLE public.travel_logs ADD COLUMN deduction_km NUMERIC(10, 3) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_logs' AND column_name = 'reimbursable_km') THEN
        ALTER TABLE public.travel_logs ADD COLUMN reimbursable_km NUMERIC(10, 3) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_logs' AND column_name = 'per_km_rate') THEN
        ALTER TABLE public.travel_logs ADD COLUMN per_km_rate NUMERIC(10, 2) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_logs' AND column_name = 'gross_amount') THEN
        ALTER TABLE public.travel_logs ADD COLUMN gross_amount NUMERIC(10, 2) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_logs' AND column_name = 'net_amount') THEN
        ALTER TABLE public.travel_logs ADD COLUMN net_amount NUMERIC(10, 2) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_logs' AND column_name = 'raw_km') THEN
        ALTER TABLE public.travel_logs ADD COLUMN raw_km NUMERIC(10, 3) DEFAULT 0.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'travel_logs' AND column_name = 'created_at') THEN
        ALTER TABLE public.travel_logs ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

GRANT ALL ON public.travel_logs TO authenticated;
GRANT ALL ON public.travel_logs TO service_role;

ALTER TABLE public.travel_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own travel logs" ON public.travel_logs;
DROP POLICY IF EXISTS "Managers can manage travel logs" ON public.travel_logs;

CREATE POLICY "Users can view their own travel logs"
ON public.travel_logs FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Managers can manage travel logs"
ON public.travel_logs FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'reporting_manager', 'hr')
    )
);


-- ----------------------------------------------------------------------------
-- 4. FIX PG_CRON ALTER_JOB FUNCTION WRAPPER & EXTENSION SAFETY
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Ensure function alter_job exists in public/cron namespace if called directly by application
CREATE OR REPLACE FUNCTION public.safe_alter_job(
    job_id bigint,
    schedule text DEFAULT NULL,
    command text DEFAULT NULL,
    db text DEFAULT NULL,
    username text DEFAULT NULL,
    active boolean DEFAULT NULL
) RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'cron' AND proname = 'alter_job') THEN
        PERFORM cron.alter_job(job_id, schedule, command, db, username, active);
    ELSE
        RAISE NOTICE 'pg_cron extension or cron.alter_job function is not available.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not execute cron.alter_job: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------------------------------
-- 5. RE-INDEX FOR HIGH-VOLUME TRAFFIC
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_route_history_user_time ON public.route_history(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_travel_logs_user_date ON public.travel_logs(user_id, travel_date);
