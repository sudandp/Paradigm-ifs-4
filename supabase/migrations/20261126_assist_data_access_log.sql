-- Paradigm Assist: audit log of every database question answered (or refused) by the chatbot.
-- Written by the server with the service-role key (bypasses RLS). Readable only by admin roles.
-- NOTE: not auto-applied. Review, then run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.assist_data_access_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asked_by        uuid REFERENCES public.users(id) ON DELETE SET NULL,
    subject_user_id uuid NULL,
    subject_site    text NULL,
    tool            text NOT NULL,
    args            jsonb NOT NULL DEFAULT '{}'::jsonb,
    allowed         boolean NOT NULL,
    note            text NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assist_data_access_log_asked_by_created
    ON public.assist_data_access_log (asked_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assist_data_access_log_subject
    ON public.assist_data_access_log (subject_user_id, created_at DESC);

ALTER TABLE public.assist_data_access_log ENABLE ROW LEVEL SECURITY;

-- Admin-only read (same role-lookup pattern as public.assist_has_role in 20261008120000_paradigm_assist_kb.sql).
-- No INSERT/UPDATE/DELETE policies: only the service role (server) writes; the log is append-only for clients.
DROP POLICY IF EXISTS "Admins read assist data access log" ON public.assist_data_access_log;
CREATE POLICY "Admins read assist data access log" ON public.assist_data_access_log
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.role_id IN ('admin', 'super_admin', 'developer', 'director')
        )
    );

COMMENT ON TABLE public.assist_data_access_log IS 'Paradigm Assist: who asked for whose data, via which tool, and whether it was allowed.';
