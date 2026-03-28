-- =============================================
-- EMAIL INTEGRATION TABLES
-- Migration: 2026-03-28
-- =============================================

-- 1. Email Templates (reusable HTML templates for reports, alerts, etc.)
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'report',
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Email Schedule Rules (automated email triggers)
CREATE TABLE IF NOT EXISTS public.email_schedule_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL DEFAULT 'scheduled',
  
  -- Schedule Config (time, frequency, day)
  schedule_config JSONB DEFAULT '{}'::jsonb,
  
  -- Event Config
  event_type TEXT,
  
  -- Document Expiry Config
  expiry_config JSONB DEFAULT '{}'::jsonb,
  
  -- Report Config
  report_type TEXT,
  report_format TEXT DEFAULT 'html',
  
  -- Recipients
  recipient_type TEXT NOT NULL DEFAULT 'role',
  recipient_roles TEXT[] DEFAULT '{}'::text[],
  recipient_user_ids UUID[] DEFAULT '{}'::uuid[],
  recipient_emails TEXT[] DEFAULT '{}'::text[],
  
  -- Control
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Email Logs (delivery audit trail)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.email_schedule_rules(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add email_config column to settings (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'settings' AND column_name = 'email_config'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN email_config JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 5. Add enableEmail flag to automated_notification_rules (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automated_notification_rules' AND column_name = 'enable_email'
  ) THEN
    ALTER TABLE public.automated_notification_rules ADD COLUMN enable_email BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'automated_notification_rules' AND column_name = 'email_template_id'
  ) THEN
    ALTER TABLE public.automated_notification_rules ADD COLUMN email_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Add sendEmail flag to notification_rules (event dispatch rules)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_rules' AND column_name = 'send_email'
  ) THEN
    ALTER TABLE public.notification_rules ADD COLUMN send_email BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON public.email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_rule_id ON public.email_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_email_schedule_rules_active ON public.email_schedule_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_email_schedule_rules_next_run ON public.email_schedule_rules(next_run_at) WHERE is_active = true;

-- 8. RLS Policies
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_schedule_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read on email_templates" ON public.email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on email_schedule_rules" ON public.email_schedule_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read on email_logs" ON public.email_logs FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert/update/delete (admin-level operations go through service role)
CREATE POLICY "Allow authenticated write on email_templates" ON public.email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write on email_schedule_rules" ON public.email_schedule_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated write on email_logs" ON public.email_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Insert default email templates
INSERT INTO public.email_templates (name, subject_template, body_template, category, variables)
VALUES 
(
  'Daily Attendance Report',
  'Daily Attendance Report — {date}',
  '<div style="font-family: ''Segoe UI'', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
  <div style="background: linear-gradient(135deg, #059669, #047857); padding: 32px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">📊 Daily Attendance Report</h1>
    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">{date}</p>
  </div>
  <div style="padding: 32px;">
    <div style="display: flex; gap: 16px; margin-bottom: 28px;">
      <div style="flex: 1; background: #f0fdf4; border-radius: 10px; padding: 20px; text-align: center; border: 1px solid #bbf7d0;">
        <div style="font-size: 28px; font-weight: 800; color: #059669;">{totalPresent}</div>
        <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Present</div>
      </div>
      <div style="flex: 1; background: #fef2f2; border-radius: 10px; padding: 20px; text-align: center; border: 1px solid #fecaca;">
        <div style="font-size: 28px; font-weight: 800; color: #dc2626;">{totalAbsent}</div>
        <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Absent</div>
      </div>
      <div style="flex: 1; background: #fffbeb; border-radius: 10px; padding: 20px; text-align: center; border: 1px solid #fde68a;">
        <div style="font-size: 28px; font-weight: 800; color: #d97706;">{lateCount}</div>
        <div style="font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Late</div>
      </div>
    </div>
    {table}
  </div>
  <div style="background: #f9fafb; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 11px; color: #9ca3af;">Automated report by Paradigm FMS • {date}</p>
  </div>
</div>',
  'report',
  '[{"key": "date", "description": "Report date"}, {"key": "totalPresent", "description": "Number of present employees"}, {"key": "totalAbsent", "description": "Number of absent employees"}, {"key": "lateCount", "description": "Number of late arrivals"}, {"key": "table", "description": "HTML table with employee details"}]'::jsonb
),
(
  'Document Expiry Alert',
  '⚠️ Document Expiring Soon: {documentType} — {entityName}',
  '<div style="font-family: ''Segoe UI'', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
  <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 28px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ Document Expiry Alert</h1>
  </div>
  <div style="padding: 28px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Entity / Site</td><td style="padding: 10px 0; font-weight: 600;">{entityName}</td></tr>
      <tr><td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Document</td><td style="padding: 10px 0; font-weight: 600;">{documentType}</td></tr>
      <tr><td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Expiry Date</td><td style="padding: 10px 0; font-weight: 600; color: #dc2626;">{expiryDate}</td></tr>
      <tr><td style="padding: 10px 0; color: #6b7280; font-size: 13px;">Days Remaining</td><td style="padding: 10px 0; font-weight: 700; color: #d97706; font-size: 18px;">{daysRemaining} days</td></tr>
    </table>
    <div style="margin-top: 20px; padding: 14px; background: #fffbeb; border-radius: 8px; border: 1px solid #fde68a;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">Please ensure this document is renewed before the expiry date to maintain compliance.</p>
    </div>
  </div>
  <div style="background: #f9fafb; padding: 16px 28px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 11px; color: #9ca3af;">Paradigm FMS — Compliance Management</p>
  </div>
</div>',
  'document_expiry',
  '[{"key": "entityName", "description": "Entity or site name"}, {"key": "documentType", "description": "Type of document"}, {"key": "expiryDate", "description": "Expiry date"}, {"key": "daysRemaining", "description": "Days until expiry"}]'::jsonb
),
(
  'General Notification Email',
  '{subject}',
  '<div style="font-family: ''Segoe UI'', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
  <div style="background: linear-gradient(135deg, #059669, #047857); padding: 28px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">📬 {subject}</h1>
  </div>
  <div style="padding: 28px;">
    <p style="color: #374151; font-size: 14px; line-height: 1.7;">{message}</p>
  </div>
  <div style="background: #f9fafb; padding: 16px 28px; text-align: center; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 11px; color: #9ca3af;">Sent by Paradigm FMS • {date}</p>
  </div>
</div>',
  'alert',
  '[{"key": "subject", "description": "Email subject"}, {"key": "message", "description": "Main message content"}, {"key": "date", "description": "Send date"}]'::jsonb
)
ON CONFLICT DO NOTHING;
