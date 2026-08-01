-- Migration: Create audit_logs table for admin impersonation audit trail
-- Run this in your Supabase SQL editor

-- Drop existing partial table (safe — no production data yet)
DROP TABLE IF EXISTS public.audit_logs;

CREATE TABLE public.audit_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Store UUIDs without FK constraints so audit rows survive user deletion
    performed_by    UUID        NOT NULL,
    performed_by_name TEXT      NOT NULL,
    target_user     UUID,
    target_user_name TEXT,
    action          TEXT        NOT NULL, -- 'impersonation_start' | 'impersonation_end'
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user  ON public.audit_logs(target_user);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON public.audit_logs(created_at DESC);

-- RLS: Only admins/developers can read; authenticated users can insert
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role_id IN ('admin', 'developer')
    )
  );

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.audit_logs IS 'Immutable audit trail for all admin impersonation events.';
COMMENT ON COLUMN public.audit_logs.action IS 'impersonation_start | impersonation_end';
COMMENT ON COLUMN public.audit_logs.reason IS 'Admin-provided reason (required before impersonation starts)';

