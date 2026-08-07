import { supabase } from './supabase';

export interface UserSitePermissionDB {
  id: string;
  user_email: string;
  user_name?: string;
  access_type: 'all' | 'restricted';
  allowed_sites: string[];
  allowed_tabs?: string[];
  validity_type: 'permanent' | 'timebound';
  valid_until_date?: string;
  password?: string;
  is_custom_account?: boolean;
  created_at?: string;
}

export interface ScreenshotAuditLogDB {
  id: string;
  user_email: string;
  user_name: string;
  timestamp: string;
  reason: string;
  capture_type: 'screenshot' | 'screen_recording';
  custom_notes?: string;
  status: 'unread' | 'viewed';
  viewed_by?: string;
  viewed_at?: string;
  page_context?: string;
}

// ─── SQL MIGRATION DEFINITIONS ────────────────────────────────────────────────
export const SUPABASE_ACCESS_CONTROL_SQL_MIGRATION = `
-- Run these SQL statements in your Supabase SQL Editor:

-- 1. Create user_site_permissions table
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

-- Ensure allowed_tabs column exists on existing Supabase deployments
ALTER TABLE public.user_site_permissions ADD COLUMN IF NOT EXISTS allowed_tabs JSONB DEFAULT '["attendance","reports","shiftConfig","userAccess","auditLogs","screenshotAudit"]'::jsonb;

-- 2. Create screenshot_audit_logs table
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

-- 3. Create shift_rule_configs table
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

-- RLS Policies
ALTER TABLE public.user_site_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screenshot_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_rule_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write user_site_permissions" ON public.user_site_permissions;
CREATE POLICY "Allow public read/write user_site_permissions" ON public.user_site_permissions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write screenshot_audit_logs" ON public.screenshot_audit_logs;
CREATE POLICY "Allow public read/write screenshot_audit_logs" ON public.screenshot_audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read/write shift_rule_configs" ON public.shift_rule_configs;
CREATE POLICY "Allow public read/write shift_rule_configs" ON public.shift_rule_configs FOR ALL USING (true) WITH CHECK (true);

-- 4. Create attendance_corrections table
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

ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write attendance_corrections" ON public.attendance_corrections;
CREATE POLICY "Allow public read/write attendance_corrections" ON public.attendance_corrections FOR ALL USING (true) WITH CHECK (true);
`;

// ─── USER SITE PERMISSIONS SUPABASE API ───────────────────────────────────────

export async function fetchPermissionsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('user_site_permissions')
      .select('*');

    if (error) {
      console.warn('Supabase user_site_permissions fetch warning (falling back to storage):', error.message);
      return null;
    }

    if (data && Array.isArray(data)) {
      return data.map((row: any) => ({
        id: row.id,
        userEmail: row.user_email,
        userName: row.user_name || row.user_email.split('@')[0],
        accessType: row.access_type || 'restricted',
        allowedSites: Array.isArray(row.allowed_sites) ? row.allowed_sites : [],
        allowedTabs: Array.isArray(row.allowed_tabs) ? row.allowed_tabs : ['attendance', 'reports', 'shiftConfig', 'userAccess', 'auditLogs', 'screenshotAudit'],
        validityType: row.validity_type || 'permanent',
        validUntilDate: row.valid_until_date || undefined,
        password: row.password || undefined,
        isCustomAccount: Boolean(row.is_custom_account),
        createdAt: row.created_at || new Date().toISOString(),
      }));
    }
    return null;
  } catch (err) {
    console.warn('Could not query Supabase user_site_permissions:', err);
    return null;
  }
}

export async function savePermissionToSupabase(perm: {
  id: string;
  userEmail: string;
  userName?: string;
  accessType: 'all' | 'restricted';
  allowedSites: string[];
  allowedTabs?: string[];
  validityType: 'permanent' | 'timebound';
  validUntilDate?: string;
  password?: string;
  isCustomAccount?: boolean;
}) {
  try {
    const payload = {
      id: perm.id,
      user_email: perm.userEmail.toLowerCase().trim(),
      user_name: perm.userName || perm.userEmail.split('@')[0],
      access_type: perm.accessType,
      allowed_sites: perm.allowedSites,
      allowed_tabs: perm.allowedTabs || ['attendance', 'reports', 'shiftConfig', 'userAccess', 'auditLogs', 'screenshotAudit'],
      validity_type: perm.validityType,
      valid_until_date: perm.validUntilDate || null,
      password: perm.password || null,
      is_custom_account: perm.isCustomAccount || false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_site_permissions')
      .upsert(payload, { onConflict: 'user_email' });

    if (error) {
      console.warn('Supabase upsert user_site_permissions error:', error.message);
    }
  } catch (err) {
    console.warn('Could not save permission to Supabase:', err);
  }
}

export async function deletePermissionFromSupabase(permId: string, userEmail: string) {
  try {
    const { error } = await supabase
      .from('user_site_permissions')
      .delete()
      .or(`id.eq.${permId},user_email.eq.${userEmail.toLowerCase().trim()}`);

    if (error) {
      console.warn('Supabase delete user_site_permissions error:', error.message);
    }
  } catch (err) {
    console.warn('Could not delete permission from Supabase:', err);
  }
}

// ─── SCREENSHOT & CAPTURE SECURITY AUDIT LOGS SUPABASE API ───────────────────

export async function fetchAuditLogsFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('screenshot_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.warn('Supabase screenshot_audit_logs fetch warning (falling back to storage):', error.message);
      return null;
    }

    if (data && Array.isArray(data)) {
      return data.map((row: any) => ({
        id: row.id,
        userEmail: row.user_email,
        userName: row.user_name || row.user_email.split('@')[0],
        timestamp: row.timestamp || new Date().toISOString(),
        reason: row.reason,
        captureType: row.capture_type || 'screenshot',
        customNotes: row.custom_notes || undefined,
        status: row.status || 'unread',
        viewedBy: row.viewed_by || undefined,
        viewedAt: row.viewed_at || undefined,
        pageContext: row.page_context || 'Site Attendance Dashboard',
      }));
    }
    return null;
  } catch (err) {
    console.warn('Could not query Supabase screenshot_audit_logs:', err);
    return null;
  }
}

export async function saveAuditLogToSupabase(log: {
  id: string;
  userEmail: string;
  userName: string;
  timestamp: string;
  reason: string;
  captureType: 'screenshot' | 'screen_recording';
  customNotes?: string;
  status: 'unread' | 'viewed';
  pageContext?: string;
}) {
  try {
    const payload = {
      id: log.id,
      user_email: log.userEmail.toLowerCase().trim(),
      user_name: log.userName,
      timestamp: log.timestamp,
      reason: log.reason,
      capture_type: log.captureType,
      custom_notes: log.customNotes || null,
      status: log.status,
      page_context: log.pageContext || 'Site Attendance Dashboard',
    };

    const { error } = await supabase
      .from('screenshot_audit_logs')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsert screenshot_audit_logs error:', error.message);
    }
  } catch (err) {
    console.warn('Could not save screenshot audit log to Supabase:', err);
  }
}

export async function markAuditLogViewedInSupabase(logId: string, adminEmail: string) {
  try {
    const payload = {
      status: 'viewed',
      viewed_by: adminEmail.toLowerCase().trim(),
      viewed_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('screenshot_audit_logs')
      .update(payload)
      .eq('id', logId);

    if (error) {
      console.warn('Supabase update screenshot_audit_logs error:', error.message);
    }
  } catch (err) {
    console.warn('Could not update screenshot audit log in Supabase:', err);
  }
}

// ─── SHIFT RULE CONFIGURATIONS SUPABASE API ─────────────────────────────

export async function fetchShiftRulesFromSupabase() {
  try {
    const { data, error } = await supabase
      .from('shift_rule_configs')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase shift_rule_configs fetch warning (falling back to storage):', error.message);
      return null;
    }

    if (data && Array.isArray(data)) {
      return data.map((row: any) => ({
        id: row.id,
        groupName: row.group_name,
        shiftCode: row.shift_code,
        startTimeSlots: row.start_time_slots,
        displayTiming: row.display_timing,
        expectedHours: Number(row.expected_hours) || 8,
        minCompletedHours: Number(row.min_completed_hours) || 6,
        siteName: row.site_name || 'All Sites',
        codePrefix: row.code_prefix || undefined,
      }));
    }
    return null;
  } catch (err) {
    console.warn('Could not query Supabase shift_rule_configs:', err);
    return null;
  }
}

export async function saveShiftRuleToSupabase(rule: {
  id: string;
  groupName: string;
  shiftCode: string;
  startTimeSlots: string;
  displayTiming: string;
  expectedHours: number;
  minCompletedHours: number;
  siteName: string;
  codePrefix?: string;
}) {
  try {
    const payload = {
      id: rule.id,
      group_name: rule.groupName,
      shift_code: rule.shiftCode,
      start_time_slots: rule.startTimeSlots,
      display_timing: rule.displayTiming,
      expected_hours: rule.expectedHours,
      min_completed_hours: rule.minCompletedHours,
      site_name: rule.siteName,
      code_prefix: rule.codePrefix || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('shift_rule_configs')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase upsert shift_rule_configs error:', error.message);
    }
  } catch (err) {
    console.warn('Could not save shift rule to Supabase:', err);
  }
}

export async function deleteShiftRuleFromSupabase(ruleId: string) {
  try {
    const { error } = await supabase
      .from('shift_rule_configs')
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.warn('Supabase delete shift_rule_configs error:', error.message);
    }
  } catch (err) {
    console.warn('Could not delete shift rule from Supabase:', err);
  }
}

// ─── ATTENDANCE CORRECTIONS SUPABASE API ─────────────────────────────────────

export interface AttendanceCorrectionDB {
  id: string;
  empCode: string;
  empName?: string;
  attendanceDate: string;
  site?: string;
  shiftName?: string;
  designation?: string;
  correctedBy: string;
  correctedAt: string;
}

export async function fetchCorrectionsFromSupabase(attendanceDate: string): Promise<AttendanceCorrectionDB[] | null> {
  try {
    const { data, error } = await supabase
      .from('attendance_corrections')
      .select('*')
      .eq('attendance_date', attendanceDate)
      .order('corrected_at', { ascending: false });

    if (error) {
      console.warn('Supabase attendance_corrections fetch warning:', error.message);
      return null;
    }

    if (data && Array.isArray(data)) {
      return data.map((row: any) => ({
        id: row.id,
        empCode: row.emp_code,
        empName: row.emp_name || undefined,
        attendanceDate: row.attendance_date,
        site: row.site || undefined,
        shiftName: row.shift_name || undefined,
        designation: row.designation || undefined,
        correctedBy: row.corrected_by,
        correctedAt: row.corrected_at || new Date().toISOString(),
      }));
    }
    return null;
  } catch (err) {
    console.warn('Could not query Supabase attendance_corrections:', err);
    return null;
  }
}

export async function saveCorrectionToSupabase(correction: AttendanceCorrectionDB): Promise<boolean> {
  try {
    const payload = {
      id: correction.id,
      emp_code: correction.empCode,
      emp_name: correction.empName || null,
      attendance_date: correction.attendanceDate,
      site: correction.site || null,
      shift_name: correction.shiftName || null,
      designation: correction.designation || null,
      corrected_by: correction.correctedBy,
      corrected_at: correction.correctedAt,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('attendance_corrections')
      .upsert(payload, { onConflict: 'emp_code,attendance_date' });

    if (error) {
      console.warn('Supabase upsert attendance_corrections error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Could not save attendance correction to Supabase:', err);
    return false;
  }
}

export async function deleteCorrectionFromSupabase(empCode: string, attendanceDate: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('attendance_corrections')
      .delete()
      .eq('emp_code', empCode)
      .eq('attendance_date', attendanceDate);

    if (error) {
      console.warn('Supabase delete attendance_corrections error:', error.message);
    }
  } catch (err) {
    console.warn('Could not delete attendance correction from Supabase:', err);
  }
}

export async function updateMssqlEmployeeDirectly(
  empCode: string,
  empName?: string,
  siteName?: string,
  designation?: string
): Promise<boolean> {
  try {
    const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const res = await fetch(`${apiBaseUrl}/api/mssql-update-employee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empCode, empName, siteName, designation })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.warn('Could not update MS SQL employee:', err);
    return false;
  }
}
