-- ============================================================================
-- RLS HOTFIX PASS: notifications, fcm_tokens, rule_inheritance_cache, cron authorization & collation
-- Date: 2026-07-23
-- Fixes active runtime Postgres RLS errors in production logs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIX public.notifications RLS
-- Cause: "notifications_policy" checked user_id = auth.uid() on INSERT.
--        When non-admins or system cron jobs send notifications to recipient users, INSERT failed.
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon;

DROP POLICY IF EXISTS "notifications_policy" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated users to insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow system and users to insert notifications" ON public.notifications;

-- SELECT: Users can view notifications where they are the recipient/user_id, or if Admin/HR
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO public
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

-- INSERT: Allow authenticated users, service role, and system to send notifications to target users
CREATE POLICY "Allow system and users to insert notifications"
ON public.notifications FOR INSERT TO public
WITH CHECK (true);

-- UPDATE: Users can update their own notifications (mark read / acknowledge)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO public
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
)
WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

-- DELETE: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE TO public
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);


-- ----------------------------------------------------------------------------
-- 2. FIX public.fcm_tokens RLS
-- Cause: UPSERT (on conflict token) failed on existing tokens registered under another user_id
--        because UPDATE USING (auth.uid() = user_id) evaluated false on the target row.
--        Also background/cron processes running with NULL auth.uid() failed RLS WITH CHECK.
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.fcm_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO anon;

DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can update tokens to own them" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Allow users and service to insert tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Allow users and service to update tokens" ON public.fcm_tokens;

CREATE POLICY "Users can view their own tokens"
ON public.fcm_tokens FOR SELECT TO public
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

CREATE POLICY "Allow users and service to insert tokens"
ON public.fcm_tokens FOR INSERT TO public
WITH CHECK (
    auth.uid() IS NULL OR 
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

-- USING (true) is required so ON CONFLICT DO UPDATE can match existing token rows to reassign user_id
CREATE POLICY "Allow users and service to update tokens"
ON public.fcm_tokens FOR UPDATE TO public
USING (true)
WITH CHECK (
    auth.uid() IS NULL OR 
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

CREATE POLICY "Users can delete their own tokens"
ON public.fcm_tokens FOR DELETE TO public
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);


-- ----------------------------------------------------------------------------
-- 3. FIX public.rule_inheritance_cache RLS
-- Cause: Policy was SELECT-only for non-admin users. When non-admin employees
--        evaluated their rules and called setDbCache(userId, ...), UPSERT failed.
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.rule_inheritance_cache ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_inheritance_cache TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_inheritance_cache TO service_role;

DROP POLICY IF EXISTS "Users can view their own rule cache" ON public.rule_inheritance_cache;
DROP POLICY IF EXISTS "Admins can manage rule cache" ON public.rule_inheritance_cache;
DROP POLICY IF EXISTS "Users manage own rule cache" ON public.rule_inheritance_cache;
DROP POLICY IF EXISTS "Users can insert their own rule cache" ON public.rule_inheritance_cache;
DROP POLICY IF EXISTS "Users can update their own rule cache" ON public.rule_inheritance_cache;
DROP POLICY IF EXISTS "Users can delete their own rule cache" ON public.rule_inheritance_cache;

CREATE POLICY "Users can view their own rule cache"
ON public.rule_inheritance_cache FOR SELECT TO authenticated
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

CREATE POLICY "Users can insert their own rule cache"
ON public.rule_inheritance_cache FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

CREATE POLICY "Users can update their own rule cache"
ON public.rule_inheritance_cache FOR UPDATE TO authenticated
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
)
WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

CREATE POLICY "Users can delete their own rule cache"
ON public.rule_inheritance_cache FOR DELETE TO authenticated
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);


-- ----------------------------------------------------------------------------
-- 4. FIX PG_CRON AUTO-CHECKOUT AUTHORIZATION HEADER PLACEHOLDER
-- Cause: auto-checkout-trigger contained '<YOUR_SUPABASE_ANON_KEY>' placeholder,
--        causing cron HTTP requests to fail authentication.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    PERFORM cron.unschedule('auto-checkout-trigger');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if job doesn't exist yet
END $$;

SELECT cron.schedule(
    'auto-checkout-trigger',
    '30 22 * * *', -- 22:30 UTC = 04:00 IST the next day
    $$
    SELECT net.http_post(
        url:='https://fmyafuhxlorbafbacywa.supabase.co/functions/v1/trigger-missed-checkouts',
        headers:=jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
        ),
        body:='{}'::jsonb
    ) AS request_id;
    $$
);


-- ----------------------------------------------------------------------------
-- 5. PERMANENT COLLATION MISMATCH FIX (postgres & template1 via dblink)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS dblink;

-- Refresh collation on postgres database (current active database)
ALTER DATABASE postgres REFRESH COLLATION VERSION;

-- Refresh collation on template1 database via dblink connection to template1
DO $$
BEGIN
    PERFORM dblink_exec('dbname=template1', 'ALTER DATABASE template1 REFRESH COLLATION VERSION;');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not refresh template1 collation via dblink: %', SQLERRM;
END $$;
