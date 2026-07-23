-- ============================================================================
-- PHASE C: PERFORMANCE OPTIMIZATION & STORAGE BUCKET LOCKDOWN
-- Date: 2026-07-23
-- Focus: Storage Bucket Public Listing Removal, Unindexed FK Covering Indexes,
--        Duplicate/Unused Index Cleanup, and Table Vacuum Statistics.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. STORAGE BUCKET LISTING LOCKDOWN
-- Prevents public listing of sensitive files in Supabase Storage.
-- ----------------------------------------------------------------------------

-- A. compliance-documents
DROP POLICY IF EXISTS "Public compliance documents listing" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view compliance documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users view compliance documents" ON storage.objects;

CREATE POLICY "Authenticated users view compliance documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'compliance-documents' AND (SELECT auth.uid()) IS NOT NULL);

-- B. gate-captures
DROP POLICY IF EXISTS "Public gate captures listing" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view gate captures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users view gate captures" ON storage.objects;

CREATE POLICY "Authenticated users view gate captures"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'gate-captures' AND (SELECT auth.uid()) IS NOT NULL);

-- C. onboarding-documents
DROP POLICY IF EXISTS "Public onboarding documents listing" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view onboarding documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users view onboarding documents" ON storage.objects;

CREATE POLICY "Authenticated users view onboarding documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'onboarding-documents' AND (SELECT auth.uid()) IS NOT NULL);


-- ----------------------------------------------------------------------------
-- 2. COVERING INDEXES FOR UNINDEXED FOREIGN KEYS
-- Accelerates cascading deletes, joins, and RLS policy evaluation.
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_rule_inheritance_cache_user_id ON public.rule_inheritance_cache(user_id);

CREATE INDEX IF NOT EXISTS idx_reimbursement_claims_user_id ON public.reimbursement_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_snapshots_user_id ON public.payroll_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_status_log_user_id ON public.attendance_daily_status_log(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_month_snapshots_employee_id ON public.attendance_month_snapshots(employee_id);

CREATE INDEX IF NOT EXISTS idx_hrm_call_logs_called_by ON public.hrm_call_logs(called_by);
CREATE INDEX IF NOT EXISTS idx_hrm_call_logs_candidate_id ON public.hrm_call_logs(candidate_id);

CREATE INDEX IF NOT EXISTS idx_hrm_activity_feed_actor_id ON public.hrm_activity_feed(actor_id);
CREATE INDEX IF NOT EXISTS idx_hrm_activity_feed_candidate_id ON public.hrm_activity_feed(candidate_id);

CREATE INDEX IF NOT EXISTS idx_document_expiry_vault_employee_id ON public.document_expiry_vault(employee_id);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_hr_user_id ON public.api_rate_limits(hr_user_id);


-- ----------------------------------------------------------------------------
-- 3. REMOVE DUPLICATE & REDUNDANT INDEXES
-- Reduces write overhead during INSERTs/UPDATEs.
-- ----------------------------------------------------------------------------

DROP INDEX IF EXISTS public.idx_fcm_tokens_token; -- Unique constraint already creates token index
DROP INDEX IF EXISTS public.idx_gate_users_qr_token; -- Unique constraint already creates qr_token index
DROP INDEX IF EXISTS public.idx_attendance_events_work_type_idx;
DROP INDEX IF EXISTS public.idx_leave_balance_lookup;
DROP INDEX IF EXISTS public.idx_snapshots_employee_month;


-- ----------------------------------------------------------------------------
-- 4. UPDATE TABLE QUERY PLANNER STATISTICS
-- ----------------------------------------------------------------------------

ANALYZE public.notifications;
ANALYZE public.fcm_tokens;
ANALYZE public.rule_inheritance_cache;
ANALYZE public.attendance_daily_status_log;
ANALYZE public.attendance_month_snapshots;
ANALYZE public.reimbursement_claims;
ANALYZE public.payroll_snapshots;
ANALYZE public.hrm_call_logs;
ANALYZE public.hrm_activity_feed;
ANALYZE public.document_expiry_vault;
ANALYZE public.api_rate_limits;
