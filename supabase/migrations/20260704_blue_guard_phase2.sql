-- =============================================================================
-- BLUE-GUARD-2026  |  Phase 2 Anti-Fraud & ISMW Migration
-- File: supabase/migrations/20260704_blue_guard_phase2.sql
-- =============================================================================
-- Run after: 20260704_blue_guard_phase1.sql

-- ── recruiter_gps_log ─────────────────────────────────────────────────────────
-- Audit trail of recruiter GPS coordinates during sensitive onboarding actions.
-- Written non-blockingly by antiFraudEngine.captureRecruiterGPS().

CREATE TABLE IF NOT EXISTS public.recruiter_gps_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recruiter_id    UUID NOT NULL,                     -- auth.users.id of the recruiter
    employee_id     UUID,                              -- onboarding_submissions.id (nullable for pre-creation events)
    action          TEXT NOT NULL,                     -- RecruiterAction enum value
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    accuracy        DOUBLE PRECISION,                  -- metres
    error           TEXT,                              -- 'GPS_UNAVAILABLE' or null
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recruiter_gps_log ENABLE ROW LEVEL SECURITY;

-- Recruiter can insert their own rows
CREATE POLICY "recruiter_insert_own_gps"
    ON public.recruiter_gps_log FOR INSERT
    WITH CHECK (auth.uid() = recruiter_id);

-- Management can view all GPS logs
CREATE POLICY "mgmt_view_gps_log"
    ON public.recruiter_gps_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role_id IN ('admin', 'management', 'security_auditor')
        )
    );

CREATE INDEX idx_gps_log_employee ON public.recruiter_gps_log (employee_id);
CREATE INDEX idx_gps_log_recruiter ON public.recruiter_gps_log (recruiter_id);
CREATE INDEX idx_gps_log_action ON public.recruiter_gps_log (action);

-- ── face_match_log ────────────────────────────────────────────────────────────
-- Stores face match results and override decisions.

CREATE TABLE IF NOT EXISTS public.face_match_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id         UUID NOT NULL,
    recruiter_id        UUID NOT NULL,
    score               SMALLINT NOT NULL,             -- 0–100
    threshold           SMALLINT NOT NULL DEFAULT 65,
    passed              BOOLEAN NOT NULL,
    method              TEXT NOT NULL DEFAULT 'pixel_sampling',
    override_by         UUID,                          -- auth.uid() if recruiter overrode failed match
    override_reason     TEXT,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.face_match_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recruiter_insert_face_match"
    ON public.face_match_log FOR INSERT
    WITH CHECK (auth.uid() = recruiter_id);

CREATE POLICY "mgmt_view_face_match"
    ON public.face_match_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role_id IN ('admin', 'management', 'security_auditor')
        )
    );

CREATE INDEX idx_face_match_employee ON public.face_match_log (employee_id);
CREATE INDEX idx_face_match_passed ON public.face_match_log (passed);

-- ── ismw_local_addresses ──────────────────────────────────────────────────────
-- ISMW compliance: local deployment-city address captured during onboarding.

CREATE TABLE IF NOT EXISTS public.ismw_local_addresses (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id             UUID NOT NULL,
    line1                   TEXT NOT NULL,
    city                    TEXT NOT NULL,
    state                   TEXT NOT NULL,
    pincode                 TEXT NOT NULL,
    landlord_name           TEXT,
    landlord_phone          TEXT,
    local_emergency_contact TEXT,
    local_emergency_phone   TEXT,
    rent_receipt_url        TEXT,                      -- Supabase Storage URL (uploaded post-capture)
    selfie_url              TEXT,                      -- Supabase Storage URL
    selfie_latitude         DOUBLE PRECISION,
    selfie_longitude        DOUBLE PRECISION,
    selfie_accuracy         DOUBLE PRECISION,
    captured_at             TIMESTAMPTZ NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_ismw_employee
        FOREIGN KEY (employee_id) REFERENCES public.onboarding_submissions (id) ON DELETE CASCADE
);

ALTER TABLE public.ismw_local_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "field_insert_ismw"
    ON public.ismw_local_addresses FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role_id IN ('field_staff', 'admin', 'management')
        )
    );

CREATE POLICY "mgmt_view_ismw"
    ON public.ismw_local_addresses FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role_id IN ('admin', 'management', 'security_auditor', 'reporting')
        )
    );

CREATE INDEX idx_ismw_employee ON public.ismw_local_addresses (employee_id);
