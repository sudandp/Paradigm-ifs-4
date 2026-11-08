-- 2026-11-08: Allow seamless insertion and access for extra_work_logs and comp_off_logs
-- Fixes RLS violation when staff submit Site OT overtime pre-approvals or comp off claims from mobile.

DROP POLICY IF EXISTS "Allow extra_work_logs access" ON public.extra_work_logs;
CREATE POLICY "Allow extra_work_logs access" ON public.extra_work_logs 
FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow comp_off_logs access" ON public.comp_off_logs;
CREATE POLICY "Allow comp_off_logs access" ON public.comp_off_logs 
FOR ALL USING (true) WITH CHECK (true);

