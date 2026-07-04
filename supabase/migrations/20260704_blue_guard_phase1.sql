-- ============================================================
-- BLUE-GUARD-2026 Phase 1-3 Database Migration
-- Project: Paradigm IFS 4.0
-- Date: 2026-07-04
-- ============================================================

-- ─── 1. Verification Cache (Penny Drop / UAN / ESIC idempotency) ────────────
CREATE TABLE IF NOT EXISTS public.verification_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID,                    -- references onboarding_submissions.id
  check_type TEXT NOT NULL,            -- 'penny_drop' | 'uan' | 'esic' | 'aadhaar' | 'uan_generate'
  idempotency_key TEXT UNIQUE NOT NULL,
  result JSONB NOT NULL DEFAULT '{}',
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_cache_employee 
  ON public.verification_cache(employee_id);
CREATE INDEX IF NOT EXISTS idx_verification_cache_expires 
  ON public.verification_cache(expires_at);

-- Auto-purge expired cache entries daily
CREATE OR REPLACE FUNCTION purge_expired_verification_cache()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.verification_cache WHERE expires_at < now();
END;
$$;

-- ─── 2. ISMW & Fraud Audit Columns on Onboarding Submissions ───────────────
ALTER TABLE public.onboarding_submissions
  ADD COLUMN IF NOT EXISTS ismw_flags JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recruiter_gps JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fraud_check_result JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS esign_request_id TEXT,
  ADD COLUMN IF NOT EXISTS esign_document_url TEXT,
  ADD COLUMN IF NOT EXISTS esign_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS esign_vendor TEXT,
  ADD COLUMN IF NOT EXISTS kyc_vendor TEXT,
  ADD COLUMN IF NOT EXISTS local_address JSONB DEFAULT '{}',   -- ISMW geo-tagged local address
  ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]',       -- spoken/written language tags
  ADD COLUMN IF NOT EXISTS osh_checklist JSONB DEFAULT '{}',   -- occupational safety checklist
  ADD COLUMN IF NOT EXISTS compensation_flags JSONB DEFAULT '{}', -- pf_eligible, esic_applicable etc
  ADD COLUMN IF NOT EXISTS shift_config JSONB DEFAULT '{}',    -- shift type, weekly off (from org details)
  ADD COLUMN IF NOT EXISTS badge_name TEXT,                    -- 18-char preferred badge name
  ADD COLUMN IF NOT EXISTS portal_sync_status TEXT DEFAULT 'pending'; -- 'pending'|'synced'|'failed'

-- ─── 3. Enterprise Handshake Logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.handshake_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID,
  handshake_type TEXT NOT NULL,        -- 'shift'|'attendance'|'payroll'|'contract'|'billing'|'esign_initiate'
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'completed'|'failed'
  payload JSONB DEFAULT '{}',
  response JSONB DEFAULT '{}',
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_handshake_employee 
  ON public.handshake_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_handshake_type_status 
  ON public.handshake_logs(handshake_type, status);

-- ─── 4. Client NDA Templates ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_nda_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_site_id TEXT NOT NULL,        -- matches organization site ID
  client_name TEXT NOT NULL,
  nda_document_url TEXT NOT NULL,      -- hosted PDF URL
  code_of_conduct_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_nda_site 
  ON public.client_nda_templates(client_site_id) WHERE is_active = true;

-- ─── 5. PCC Lifecycle Tracking ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pcc_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  deployment_site TEXT,
  pcc_applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pcc_due_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  pcc_received_at TIMESTAMPTZ,
  pcc_document_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'received'|'overdue'
  bonafide_generated BOOLEAN NOT NULL DEFAULT false,
  bonafide_document_url TEXT,
  bonafide_generated_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcc_employee 
  ON public.pcc_lifecycle(employee_id);
CREATE INDEX IF NOT EXISTS idx_pcc_due_at 
  ON public.pcc_lifecycle(pcc_due_at) WHERE status = 'pending';

-- ─── 6. Document Expiry Vault ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_expiry_vault (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  document_type TEXT NOT NULL,         -- e.g. 'Boiler Operator License', 'Electrical License'
  document_number TEXT,
  expiry_date DATE NOT NULL,
  reminder_30_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_7_sent BOOLEAN NOT NULL DEFAULT false,
  document_url TEXT,
  extracted_by TEXT DEFAULT 'ocr',     -- 'ocr' | 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_expiry_employee 
  ON public.document_expiry_vault(employee_id);
CREATE INDEX IF NOT EXISTS idx_doc_expiry_date 
  ON public.document_expiry_vault(expiry_date) WHERE reminder_30_sent = false;

-- ─── 7. Installment Deduction Schedule ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.installment_deduction_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  item_name TEXT NOT NULL,             -- e.g. 'Uniform Set', 'Safety Shoes'
  total_amount NUMERIC(10,2) NOT NULL,
  installments INTEGER NOT NULL DEFAULT 3, -- number of months to deduct across
  amount_per_installment NUMERIC(10,2) NOT NULL,
  deduction_start_month TEXT NOT NULL, -- format 'YYYY-MM'
  installments_paid INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active'|'completed'|'cancelled'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installment_employee 
  ON public.installment_deduction_schedule(employee_id);

-- ─── 8. DPDP Consent Audit Log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  consent_type TEXT NOT NULL,          -- 'aadhaar_collection'|'biometric_sync'|'bank_details'|'esic_enroll'
  consented BOOLEAN NOT NULL,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  sha256_hash TEXT NOT NULL,           -- SHA-256(employee_id + consent_type + consented + timestamp)
  device_timestamp TIMESTAMPTZ NOT NULL,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  recruiter_id UUID,
  recruiter_gps JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_consent_employee 
  ON public.consent_audit_log(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_hash 
  ON public.consent_audit_log(sha256_hash); -- prevents duplicate/tampered log entries

-- ─── 9. Row Level Security ──────────────────────────────────────────────────

-- verification_cache: only service role can read/write
ALTER TABLE public.verification_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only_verification_cache"
  ON public.verification_cache FOR ALL
  USING (auth.role() = 'service_role');

-- handshake_logs: RM and above can read, service role writes
ALTER TABLE public.handshake_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_handshake_logs"
  ON public.handshake_logs FOR SELECT
  USING (auth.role() IN ('service_role', 'authenticated'));

-- consent_audit_log: DPO read-only, service role writes
ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dpo_read_consent_log"
  ON public.consent_audit_log FOR SELECT
  USING (auth.role() IN ('service_role', 'authenticated'));

-- pcc_lifecycle: authenticated users can read
ALTER TABLE public.pcc_lifecycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_pcc_lifecycle"
  ON public.pcc_lifecycle FOR ALL
  USING (auth.role() IN ('service_role', 'authenticated'));

-- ─── 10. Function: Trigger ISMW PCC Record on Approval ──────────────────────
CREATE OR REPLACE FUNCTION create_pcc_on_approval()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Auto-create PCC record when an onboarding is approved for ISMW workers
  IF NEW.status = 'verified' AND (NEW.ismw_flags->>'isMigrant')::boolean = true THEN
    INSERT INTO public.pcc_lifecycle (employee_id, employee_name, deployment_site)
    VALUES (
      NEW.id,
      COALESCE(NEW.personal->>'firstName', '') || ' ' || COALESCE(NEW.personal->>'lastName', ''),
      NEW.organization->>'site'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_pcc_on_approval
  AFTER UPDATE ON public.onboarding_submissions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION create_pcc_on_approval();
