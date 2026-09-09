-- 20260909_create_attendance_corrections.sql
-- Create attendance_corrections table for Site Attendance Dashboard manual employee corrections / overrides

CREATE TABLE IF NOT EXISTS public.attendance_corrections (
    id TEXT PRIMARY KEY,
    emp_code TEXT NOT NULL,
    emp_name TEXT,
    attendance_date TEXT NOT NULL,
    site TEXT,
    shift_name TEXT,
    designation TEXT,
    corrected_by TEXT NOT NULL,
    corrected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (emp_code, attendance_date)
);

-- Enable Row Level Security
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;

-- Allow public / authenticated access
DROP POLICY IF EXISTS "Allow public read/write attendance_corrections" ON public.attendance_corrections;
CREATE POLICY "Allow public read/write attendance_corrections" 
    ON public.attendance_corrections 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Helpful indexes for rapid lookups by date & employee code
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_date ON public.attendance_corrections(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_emp_code ON public.attendance_corrections(emp_code);

-- Also ensure user_site_permissions, screenshot_audit_logs, shift_rule_configs exist if needed
CREATE TABLE IF NOT EXISTS public.user_site_permissions (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL UNIQUE,
    user_name TEXT,
    access_type TEXT NOT NULL DEFAULT 'restricted',
    allowed_sites JSONB NOT NULL DEFAULT '[]'::jsonb,
    allowed_tabs JSONB NOT NULL DEFAULT '["attendance","reports","shiftConfig","userAccess","auditLogs","screenshotAudit"]'::jsonb,
    validity_type TEXT NOT NULL DEFAULT 'permanent',
    valid_until_date TEXT,
    password TEXT,
    is_custom_account BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_site_permissions ADD COLUMN IF NOT EXISTS allowed_tabs JSONB DEFAULT '["attendance","reports","shiftConfig","userAccess","auditLogs","screenshotAudit"]'::jsonb;
ALTER TABLE public.user_site_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write user_site_permissions" ON public.user_site_permissions;
CREATE POLICY "Allow public read/write user_site_permissions" ON public.user_site_permissions FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.screenshot_audit_logs (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT NOT NULL,
    capture_type TEXT NOT NULL DEFAULT 'screenshot',
    custom_notes TEXT,
    status TEXT NOT NULL DEFAULT 'unread',
    viewed_by TEXT,
    viewed_at TIMESTAMPTZ,
    page_context TEXT DEFAULT 'Site Attendance Dashboard',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.screenshot_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write screenshot_audit_logs" ON public.screenshot_audit_logs;
CREATE POLICY "Allow public read/write screenshot_audit_logs" ON public.screenshot_audit_logs FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.shift_rule_configs (
    id TEXT PRIMARY KEY,
    group_name TEXT NOT NULL,
    shift_code TEXT NOT NULL,
    start_time_slots TEXT NOT NULL,
    display_timing TEXT NOT NULL,
    expected_hours NUMERIC NOT NULL DEFAULT 8,
    min_completed_hours NUMERIC NOT NULL DEFAULT 6,
    site_name TEXT NOT NULL DEFAULT 'All Sites',
    code_prefix TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shift_rule_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write shift_rule_configs" ON public.shift_rule_configs;
CREATE POLICY "Allow public read/write shift_rule_configs" ON public.shift_rule_configs FOR ALL USING (true) WITH CHECK (true);
