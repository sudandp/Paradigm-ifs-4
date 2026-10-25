-- Migration: 20261024230000_helpdesk_sla_closure_otp.sql
-- Description: Helpdesk SLA Policies, Escalation Engine, and Resident Closure OTP Handshake (Enterprise Facility OS)

-- 1. Create SLA Rule Definitions Table
CREATE TABLE IF NOT EXISTS public.helpdesk_sla_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    response_time_minutes INT NOT NULL,
    resolution_time_minutes INT NOT NULL,
    escalation_contact_role TEXT DEFAULT 'facility_manager',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed standard default SLA policies if table is empty
INSERT INTO public.helpdesk_sla_policies (category, priority, response_time_minutes, resolution_time_minutes)
VALUES
    ('Electrical', 'P1', 15, 120),
    ('Electrical', 'P2', 30, 360),
    ('Electrical', 'P3', 120, 1440),
    ('Electrical', 'P4', 240, 2880),
    ('Plumbing', 'P1', 15, 120),
    ('Plumbing', 'P2', 30, 360),
    ('Plumbing', 'P3', 120, 1440),
    ('Plumbing', 'P4', 240, 2880),
    ('HVAC', 'P1', 15, 120),
    ('HVAC', 'P2', 30, 360),
    ('HVAC', 'P3', 120, 1440),
    ('HVAC', 'P4', 240, 2880),
    ('General', 'P1', 15, 120),
    ('General', 'P2', 30, 360),
    ('General', 'P3', 120, 1440),
    ('General', 'P4', 240, 2880)
ON CONFLICT DO NOTHING;

-- 2. Enhance ops_tickets with SLA & OTP fields
ALTER TABLE public.ops_tickets
    ADD COLUMN IF NOT EXISTS unit_number TEXT,
    ADD COLUMN IF NOT EXISTS resident_name TEXT,
    ADD COLUMN IF NOT EXISTS resident_phone TEXT,
    ADD COLUMN IF NOT EXISTS resident_user_id UUID,
    ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_responded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS escalation_level INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS closure_otp TEXT,
    ADD COLUMN IF NOT EXISTS closure_otp_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closure_otp_attempts INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS closure_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closure_verified_by UUID,
    ADD COLUMN IF NOT EXISTS admin_override BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS admin_override_reason TEXT,
    ADD COLUMN IF NOT EXISTS admin_override_photo_url TEXT,
    ADD COLUMN IF NOT EXISTS rating INT CHECK (rating >= 1 AND rating <= 5),
    ADD COLUMN IF NOT EXISTS feedback_tags TEXT[],
    ADD COLUMN IF NOT EXISTS feedback_comment TEXT;

-- 3. Create Indexes for Fast SLA Triage and Escalation Queries
CREATE INDEX IF NOT EXISTS idx_ops_tickets_escalated ON public.ops_tickets(is_escalated, status);
CREATE INDEX IF NOT EXISTS idx_ops_tickets_resolution_due ON public.ops_tickets(resolution_due_at) WHERE status IN ('Open', 'In Progress');
CREATE INDEX IF NOT EXISTS idx_ops_tickets_unit_number ON public.ops_tickets(unit_number);

-- 4. Auto-Calculate SLA Deadlines on Insert Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_calculate_ticket_sla()
RETURNS TRIGGER AS $$
DECLARE
    v_res_mins INT := 1440;
    v_resp_mins INT := 120;
BEGIN
    SELECT response_time_minutes, resolution_time_minutes 
    INTO v_resp_mins, v_res_mins
    FROM public.helpdesk_sla_policies
    WHERE category = NEW.category AND priority = NEW.priority
    LIMIT 1;

    IF v_res_mins IS NULL THEN
        IF NEW.priority = 'P1' THEN v_res_mins := 120; v_resp_mins := 15;
        ELSIF NEW.priority = 'P2' THEN v_res_mins := 360; v_resp_mins := 30;
        ELSIF NEW.priority = 'P3' THEN v_res_mins := 1440; v_resp_mins := 120;
        ELSE v_res_mins := 2880; v_resp_mins := 240;
        END IF;
    END IF;

    IF NEW.response_due_at IS NULL THEN
        NEW.response_due_at := COALESCE(NEW.created_at, NOW()) + (v_resp_mins || ' minutes')::INTERVAL;
    END IF;

    IF NEW.resolution_due_at IS NULL THEN
        NEW.resolution_due_at := COALESCE(NEW.created_at, NOW()) + (v_res_mins || ' minutes')::INTERVAL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ops_tickets_sla ON public.ops_tickets;
CREATE TRIGGER trg_ops_tickets_sla
    BEFORE INSERT ON public.ops_tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fn_calculate_ticket_sla();
