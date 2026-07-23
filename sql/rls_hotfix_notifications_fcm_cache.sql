-- ============================================================================
-- RLS HOTFIX PASS: notifications, fcm_tokens, rule_inheritance_cache
-- Date: 2026-07-23
-- Fixes active runtime Postgres RLS errors in production logs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FIX public.notifications RLS
-- Cause: "notifications_policy" checked user_id = auth.uid() on INSERT.
--        When non-admins send notifications to recipient users, INSERT failed.
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

-- SELECT: Users can view notifications where they are the recipient/user_id, or if Admin/HR
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

-- INSERT: Allow authenticated users to send/insert notifications to target users
CREATE POLICY "Allow authenticated users to insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (true);

-- UPDATE: Users can update their own notifications (mark read / acknowledge)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
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
ON public.notifications FOR DELETE TO authenticated
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
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.fcm_tokens ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO service_role;

DROP POLICY IF EXISTS "Users can manage their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can update tokens to own them" ON public.fcm_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.fcm_tokens;

CREATE POLICY "Users can view their own tokens"
ON public.fcm_tokens FOR SELECT TO authenticated
USING (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

CREATE POLICY "Users can insert their own tokens"
ON public.fcm_tokens FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

-- USING (true) is required so ON CONFLICT DO UPDATE can match existing token rows to reassign user_id
CREATE POLICY "Users can update tokens to own them"
ON public.fcm_tokens FOR UPDATE TO authenticated
USING (true)
WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = auth.uid() 
        AND u.role_id IN ('admin', 'super_admin', 'developer', 'management', 'hr')
    )
);

CREATE POLICY "Users can delete their own tokens"
ON public.fcm_tokens FOR DELETE TO authenticated
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
