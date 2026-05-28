-- Migration: HR & Letters Management Module (Phase 1)
-- Date: 2026-05-28

-- 1. Create hrm_call_logs table
CREATE TABLE IF NOT EXISTS public.hrm_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidate_referrals(id) ON DELETE CASCADE,
    called_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    called_at TIMESTAMPTZ NOT NULL,
    duration_mins INT,
    outcome TEXT NOT NULL CHECK (outcome IN ('reached', 'no_answer', 'callback', 'not_interested', 'interested')),
    notes TEXT,
    next_call_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create hrm_candidate_stages table
CREATE TABLE IF NOT EXISTS public.hrm_candidate_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidate_referrals(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('new', 'contacted', 'screened', 'interview', 'offer', 'joined', 'rejected')),
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT
);

-- 3. Create hrm_activity_feed table
CREATE TABLE IF NOT EXISTS public.hrm_activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidate_referrals(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('call_logged', 'stage_changed', 'note_added', 'interview_scheduled', 'offer_made', 'joined', 'rejected', 'letter_issued')),
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    visible_to_referrer BOOLEAN DEFAULT TRUE
);

-- 4. Create hrm_screening_forms table
CREATE TABLE IF NOT EXISTS public.hrm_screening_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID UNIQUE REFERENCES public.candidate_referrals(id) ON DELETE CASCADE,
    current_ctc DECIMAL(12,2),
    expected_ctc DECIMAL(12,2),
    notice_period_days INT,
    availability_date DATE,
    interest_level TEXT NOT NULL CHECK (interest_level IN ('high', 'medium', 'low')),
    screened_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    screened_at TIMESTAMPTZ,
    notes TEXT
);

-- 5. Create hrm_letter_templates table
CREATE TABLE IF NOT EXISTS public.hrm_letter_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    letter_type TEXT UNIQUE NOT NULL CHECK (letter_type IN ('offer', 'appointment', 'confirmation', 'promotion', 'increment', 'transfer', 'warning', 'show_cause', 'experience', 'termination')),
    name TEXT NOT NULL,
    body_html TEXT NOT NULL,
    requires_approval BOOLEAN DEFAULT FALSE,
    approval_role TEXT CHECK (approval_role IN ('admin', 'hr_head')),
    ack_required_default BOOLEAN DEFAULT FALSE,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create hrm_letters table
CREATE TABLE IF NOT EXISTS public.hrm_letters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidate_referrals(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    letter_type TEXT NOT NULL CHECK (letter_type IN ('offer', 'appointment', 'confirmation', 'promotion', 'increment', 'transfer', 'warning', 'show_cause', 'experience', 'termination')),
    template_snapshot TEXT NOT NULL,
    variables_used JSONB,
    pdf_path TEXT,
    ref_number TEXT UNIQUE NOT NULL,
    issued_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ,
    version INT DEFAULT 1,
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending_approval', 'issued', 'revoked')),
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approval_note TEXT,
    ack_required BOOLEAN DEFAULT FALSE,
    ack_status TEXT CHECK (ack_status IN ('pending', 'sent', 'opened', 'acknowledged')),
    ack_at TIMESTAMPTZ
);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='candidate_referrals' AND column_name='candidate_email') THEN
        ALTER TABLE public.candidate_referrals ADD COLUMN candidate_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='candidate_referrals' AND column_name='current_stage') THEN
        ALTER TABLE public.candidate_referrals ADD COLUMN current_stage VARCHAR(20) DEFAULT 'new';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='candidate_referrals' AND column_name='assigned_hr_id') THEN
        ALTER TABLE public.candidate_referrals ADD COLUMN assigned_hr_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='candidate_referrals' AND column_name='joining_date') THEN
        ALTER TABLE public.candidate_referrals ADD COLUMN joining_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='candidate_referrals' AND column_name='probation_end_date') THEN
        ALTER TABLE public.candidate_referrals ADD COLUMN probation_end_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='candidate_referrals' AND column_name='confirmed_at') THEN
        ALTER TABLE public.candidate_referrals ADD COLUMN confirmed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='candidate_referrals' AND column_name='bonus_eligible') THEN
        ALTER TABLE public.candidate_referrals ADD COLUMN bonus_eligible BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='candidate_referrals' AND column_name='bonus_paid_at') THEN
        ALTER TABLE public.candidate_referrals ADD COLUMN bonus_paid_at TIMESTAMPTZ;
    END IF;
END $$;

-- 8. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.hrm_call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrm_candidate_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrm_activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrm_screening_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrm_letter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrm_letters ENABLE ROW LEVEL SECURITY;

-- 9. Create simple RLS policies allowing all operations for testing and prototype use
DROP POLICY IF EXISTS "hrm_call_logs_all" ON public.hrm_call_logs;
CREATE POLICY "hrm_call_logs_all" ON public.hrm_call_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "hrm_candidate_stages_all" ON public.hrm_candidate_stages;
CREATE POLICY "hrm_candidate_stages_all" ON public.hrm_candidate_stages FOR ALL USING (true);

DROP POLICY IF EXISTS "hrm_activity_feed_all" ON public.hrm_activity_feed;
CREATE POLICY "hrm_activity_feed_all" ON public.hrm_activity_feed FOR ALL USING (true);

DROP POLICY IF EXISTS "hrm_screening_forms_all" ON public.hrm_screening_forms;
CREATE POLICY "hrm_screening_forms_all" ON public.hrm_screening_forms FOR ALL USING (true);

DROP POLICY IF EXISTS "hrm_letter_templates_all" ON public.hrm_letter_templates;
CREATE POLICY "hrm_letter_templates_all" ON public.hrm_letter_templates FOR ALL USING (true);

DROP POLICY IF EXISTS "hrm_letters_all" ON public.hrm_letters;
CREATE POLICY "hrm_letters_all" ON public.hrm_letters FOR ALL USING (true);

-- 10. Seed hrm_letter_templates with MNC-standard HTML templates
INSERT INTO public.hrm_letter_templates (letter_type, name, body_html, requires_approval, approval_role, ack_required_default) VALUES
('offer', 'Offer Letter', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To,<br><strong>{{candidate_name}}</strong></p>
    <p>Subject: Offer of Employment for the position of <strong>{{designation}}</strong></p>
    <p>Dear {{candidate_name}},</p>
    <p>We are pleased to offer you employment with {{company_name}} in the position of <strong>{{designation}}</strong> in our <strong>{{department}}</strong> department, based out of our <strong>{{location}}</strong> office.</p>
    <p>Your annual Gross CTC will be <strong>{{ctc_annual}}</strong> (Monthly: <strong>{{ctc_monthly}}</strong>). You are scheduled to join us on or before <strong>{{joining_date}}</strong>. You will be reporting directly to <strong>{{reporting_manager}}</strong>.</p>
    <p>You will be on probation for a period of <strong>{{probation_days}}</strong> days, upon successful completion of which you will be confirmed in writing.</p>
    <p>Please sign and return the duplicate copy of this letter as a token of your acceptance.</p>
    <br>
    <p>Sincerely,</p>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', false, NULL, true),

('appointment', 'Appointment Letter', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To,<br><strong>{{candidate_name}}</strong></p>
    <p>Subject: Appointment Letter</p>
    <p>Dear {{candidate_name}},</p>
    <p>Consequent to your acceptance of our offer, we are pleased to appoint you as <strong>{{designation}}</strong> at {{company_name}}, with effect from your date of joining <strong>{{joining_date}}</strong>.</p>
    <p>Your duties and responsibilities will be as discussed and assigned by your reporting manager <strong>{{reporting_manager}}</strong>. Your services are subject to a probation period of <strong>{{probation_days}}</strong> days.</p>
    <p>The detailed terms and conditions of your employment are annexed to this letter. Kindly sign the acknowledgment copy of this letter to confirm your acceptance.</p>
    <br>
    <p>For {{company_name}},</p>
    <br>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', false, NULL, true),

('confirmation', 'Employment Confirmation Letter', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To,<br><strong>{{candidate_name}}</strong></p>
    <p>Subject: Confirmation of Services</p>
    <p>Dear {{candidate_name}},</p>
    <p>Following the review of your performance during your probation period of <strong>{{probation_days}}</strong> days starting from <strong>{{joining_date}}</strong>, we are pleased to confirm your services as a permanent employee of {{company_name}} in the position of <strong>{{designation}}</strong>.</p>
    <p>All other terms and conditions of your appointment letter dated <strong>{{joining_date}}</strong> remain unchanged. We look forward to your continued contribution to the company.</p>
    <br>
    <p>Best regards,</p>
    <br>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', false, NULL, false),

('promotion', 'Promotion Letter', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To,<br><strong>{{candidate_name}}</strong></p>
    <p>Subject: Promotion to <strong>{{new_designation}}</strong></p>
    <p>Dear {{candidate_name}},</p>
    <p>Based on your excellent performance and outstanding contributions during your tenure, we are delighted to promote you from <strong>{{old_designation}}</strong> to <strong>{{new_designation}}</strong>, effective from <strong>{{joining_date}}</strong>.</p>
    <p>With this promotion, your annual Gross CTC will be revised to <strong>{{new_ctc}}</strong> (previously <strong>{{old_ctc}}</strong>), reflecting a hike of <strong>{{hike_percent}}%</strong>. All other benefits and terms of your employment will be governed by the revised employee policy.</p>
    <p>Congratulations on this well-deserved promotion. We wish you continued success in your new role.</p>
    <br>
    <p>Sincerely,</p>
    <br>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', false, NULL, true),

('increment', 'Salary Revision Letter', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To,<br><strong>{{candidate_name}}</strong></p>
    <p>Subject: Annual Salary Increment</p>
    <p>Dear {{candidate_name}},</p>
    <p>In recognition of your performance and dedication to {{company_name}}, we are pleased to inform you that your salary has been revised with effect from <strong>{{joining_date}}</strong>.</p>
    <p>Your new annual Gross CTC will be <strong>{{new_ctc}}</strong> (revised from <strong>{{old_ctc}}</strong>), which represents an increment of <strong>{{hike_percent}}%</strong>. We thank you for your commitment and look forward to achieving new milestones together.</p>
    <br>
    <p>Warm regards,</p>
    <br>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', false, NULL, true),

('transfer', 'Transfer Letter', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To,<br><strong>{{candidate_name}}</strong></p>
    <p>Subject: Inter-departmental/Location Transfer</p>
    <p>Dear {{candidate_name}},</p>
    <p>This is to inform you that you are being transferred from your current location/role to <strong>{{location}}</strong> in the position of <strong>{{designation}}</strong>, effective from <strong>{{joining_date}}</strong>.</p>
    <p>You will be reporting to <strong>{{reporting_manager}}</strong> at the new location. Your compensation, tenure, and other benefits will remain unchanged. Please ensure a smooth handover of your current responsibilities before your transfer date.</p>
    <br>
    <p>For {{company_name}},</p>
    <br>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', false, NULL, true),

('warning', 'Written Warning Letter', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To,<br><strong>{{candidate_name}}</strong></p>
    <p>Subject: Written Warning - <strong>{{warning_level}}</strong></p>
    <p>Dear {{candidate_name}},</p>
    <p>This is a formal written warning regarding your conduct/performance. Specifically, on <strong>{{incident_date}}</strong>, it was observed that you failed to adhere to the company standards/policies.</p>
    <p>This behavior is unacceptable and constitutes a violation of {{company_name}}''s code of conduct. You are required to immediately correct this and show immediate improvement. Failure to do so will result in further disciplinary action, up to and including termination.</p>
    <br>
    <p>From,</p>
    <br>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', false, NULL, true),

('show_cause', 'Show Cause Notice', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To,<br><strong>{{candidate_name}}</strong></p>
    <p>Subject: Show Cause Notice</p>
    <p>Dear {{candidate_name}},</p>
    <p>It has been brought to our attention that on <strong>{{incident_date}}</strong>, you were involved in an incident of misconduct/non-performance. You are hereby requested to show cause in writing within 48 hours of receipt of this notice why disciplinary action should not be initiated against you.</p>
    <p>If you fail to submit a written explanation within the stipulated time, it will be assumed that you have no explanation to offer and the management will proceed with appropriate action.</p>
    <br>
    <p>For {{company_name}},</p>
    <br>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', false, NULL, true),

('experience', 'Experience & Relieving Certificate', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To Whom It May Concern</p>
    <p>This is to certify that <strong>{{candidate_name}}</strong> was employed with {{company_name}} as <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department from <strong>{{joining_date}}</strong> to <strong>{{last_working_day}}</strong>.</p>
    <p>During their tenure of <strong>{{tenure_years}}</strong> years and <strong>{{tenure_months}}</strong> months, their conduct was found to be satisfactory. We relieve them of their duties at the close of business hours on <strong>{{last_working_day}}</strong> and wish them the very best in all future endeavors.</p>
    <br>
    <p>For {{company_name}},</p>
    <br>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', false, NULL, false),

('termination', 'Letter of Termination', '<div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; color: #333;">
  <div style="text-align: center; border-bottom: 2px solid #006B3F; padding-bottom: 20px;">
    <h2>{{company_name}}</h2>
    <p>{{company_address}}</p>
  </div>
  <div style="margin-top: 30px;">
    <p><strong>Ref Number:</strong> {{ref_number}}</p>
    <p><strong>Date:</strong> {{issue_date}}</p>
    <p>To,<br><strong>{{candidate_name}}</strong></p>
    <p>Subject: Termination of Employment Services</p>
    <p>Dear {{candidate_name}},</p>
    <p>We regret to inform you that your employment with {{company_name}} is being terminated with effect from <strong>{{last_working_day}}</strong>, due to reasons of performance/conduct as previously communicated.</p>
    <p>Your full and final settlement will be processed within the standard window. Please return all company assets in your possession to the HR department on or before your last working day.</p>
    <br>
    <p>For {{company_name}},</p>
    <br>
    <p><strong>{{hr_name}}</strong><br>{{hr_designation}}</p>
  </div>
</div>', true, 'admin', true)
ON CONFLICT (letter_type) DO UPDATE SET
  name = EXCLUDED.name,
  body_html = EXCLUDED.body_html,
  requires_approval = EXCLUDED.requires_approval,
  approval_role = EXCLUDED.approval_role,
  ack_required_default = EXCLUDED.ack_required_default;
