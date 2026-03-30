// @ts-nocheck — This file runs in Deno (Supabase Edge Functions), not Node.js.
// The TypeScript IDE may not resolve Deno imports; runtime types are correct.
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format, startOfDay } from "https://esm.sh/date-fns@2.30.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// ─── SMTP via HTTP API (Deno Deploy blocks SMTP ports 25/465/587) ────────
// We call the Vercel /api/send-email endpoint which uses nodemailer 
async function sendEmailViaHTTP(
  emailConfig: EmailConfig,
  to: string[],
  subject: string,
  html: string,
  ruleId?: string,
  templateId?: string,
): Promise<void> {
  // Try Vercel API first
  const vercelUrl = Deno.env.get('VERCEL_APP_URL') || 'https://app.paradigmfms.com';
  const internalApiKey = Deno.env.get('INTERNAL_API_KEY') || '';
  
  const apiUrl = `${vercelUrl}/api/send-email`;
  console.log(`  [sendEmailViaHTTP] Calling ${apiUrl} for ${to.length} recipients...`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': internalApiKey,
    },
    body: JSON.stringify({
      to,
      subject,
      html,
      ruleId,
      templateId,
      smtpConfig: {
        host: emailConfig.host || 'smtp.gmail.com',
        port: Number(emailConfig.port) || 587,
        secure: emailConfig.secure || false,
        user: emailConfig.user,
        pass: emailConfig.pass,
        fromEmail: emailConfig.from_email || emailConfig.user,
        fromName: emailConfig.from_name || 'Paradigm FMS',
        replyTo: emailConfig.reply_to,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`HTTP send-email failed (${response.status}): ${errBody}`);
  }

  const result = await response.json();
  console.log(`  [sendEmailViaHTTP] Success:`, JSON.stringify(result));
}

interface EmailConfig {
  user: string;
  pass: string;
  enabled: boolean;
  host?: string;
  port?: number | string;
  secure?: boolean;
  from_email?: string;
  from_name?: string;
  reply_to?: string;
}

interface EmailTemplate {
  id: string;
  subject_template?: string;
  body_template?: string;
}

interface EmailScheduleRule {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  report_type: string;
  template_id: string;
  schedule_config?: ScheduleConfig;
  recipient_type: string;
  recipient_emails?: string[];
  recipient_roles?: string[];
  recipient_user_ids?: string[];
  last_sent_at?: string;
}

interface ScheduleConfig {
  time?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
}

interface User {
  id: string;
  name: string;
  email?: string;
  role: { display_name: string } | { display_name: string }[];
  is_active?: boolean;
}

interface AttendanceEvent {
  user_id: string;
  type: string;
  timestamp: string;
}

interface LeaveRequest {
  user_id: string;
}

// ─── Helper: Get IST date string (YYYY-MM-DD) from a UTC Date ──────────────
function getISTDateString(date: Date): string {
  const istTime = new Date(date.getTime() + IST_OFFSET);
  return istTime.toISOString().substring(0, 10);
}

// ─── Helper: Get IST hours and minutes from a UTC Date ──────────────────────
function getISTHoursMinutes(date: Date): { hours: number; minutes: number } {
  const istTime = new Date(date.getTime() + IST_OFFSET);
  return {
    hours: istTime.getUTCHours(),
    minutes: istTime.getUTCMinutes(),
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { ruleId, force } = body;

    const now = new Date();
    const istTime = getISTHoursMinutes(now);
    const istDateStr = getISTDateString(now);

    console.log(`[process-email-schedules] ═══════════════════════════════════════`);
    console.log(`[process-email-schedules] Triggered at UTC: ${now.toISOString()}`);
    console.log(`[process-email-schedules] IST Time: ${istDateStr} ${String(istTime.hours).padStart(2,'0')}:${String(istTime.minutes).padStart(2,'0')}`);
    console.log(`[process-email-schedules] Params: ruleId=${ruleId}, force=${force}`);

    // ── Fetch email config ──
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('email_config')
      .eq('id', 'singleton')
      .single();

    if (settingsError) {
      console.error(`[process-email-schedules] Failed to fetch settings:`, settingsError.message);
      throw settingsError;
    }
    const emailConfig = settings?.email_config as EmailConfig;

    if (!emailConfig?.user || !emailConfig?.pass || !emailConfig?.enabled) {
      console.log(`[process-email-schedules] Email not configured. user=${!!emailConfig?.user}, pass=${!!emailConfig?.pass}, enabled=${emailConfig?.enabled}`);
      return new Response(JSON.stringify({ message: 'Email not configured or disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-email-schedules] Email config OK (host: ${emailConfig.host || 'smtp.gmail.com'}, user: ${emailConfig.user})`);

    // ── Fetch active rules ──
    let query = supabase.from('email_schedule_rules').select('*').eq('is_active', true);
    if (ruleId) query = query.eq('id', ruleId);
    const { data: rules, error: rulesErr } = await query;
    const typedRules = (rules || []) as EmailScheduleRule[];
    if (rulesErr) {
      console.error(`[process-email-schedules] Failed to fetch rules:`, rulesErr.message);
      throw rulesErr;
    }
    if (!typedRules || typedRules.length === 0) {
      console.log(`[process-email-schedules] No active schedule rules found`);
      return new Response(JSON.stringify({ message: 'No active schedules' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-email-schedules] Found ${typedRules.length} active rule(s)`);

    // ── Fetch templates ──
    const { data: templates } = await supabase.from('email_templates').select('*');
    const typedTemplates = (templates || []) as EmailTemplate[];
    const templateMap = new Map<string, EmailTemplate>(typedTemplates.map(t => [t.id, t]));

    const nowIST = new Date(now.getTime() + IST_OFFSET);
    let totalSent = 0;
    const processingLog: any[] = [];

    for (const rule of typedRules) {
      console.log(`\n[process-email-schedules] ─── Processing rule: "${rule.name}" ───`);
      console.log(`  trigger_type: ${rule.trigger_type}, report_type: ${rule.report_type}`);
      console.log(`  schedule_config: ${JSON.stringify(rule.schedule_config)}`);
      console.log(`  last_sent_at: ${rule.last_sent_at || 'NEVER'}`);

      const isForceRun = force === true || (ruleId !== undefined && ruleId === rule.id);

      if (rule.trigger_type === 'scheduled' && !isForceRun) {
        // ── Time check ──
        const config = rule.schedule_config || {};
        const scheduleTime = config.time || '21:00';
        const [schedHour, schedMinute] = scheduleTime.split(':').map(Number);
        
        console.log(`  Schedule time: ${scheduleTime} IST (${schedHour}:${String(schedMinute).padStart(2,'0')})`);
        console.log(`  Current IST:  ${String(istTime.hours).padStart(2,'0')}:${String(istTime.minutes).padStart(2,'0')}`);

        // Check if current IST time has passed the scheduled time
        const currentTotalMinutes = istTime.hours * 60 + istTime.minutes;
        const scheduleTotalMinutes = schedHour * 60 + schedMinute;

        if (currentTotalMinutes < scheduleTotalMinutes) {
          const reason = `Time ${scheduleTime} IST not reached yet (current IST: ${String(istTime.hours).padStart(2,'0')}:${String(istTime.minutes).padStart(2,'0')})`;
          console.log(`  → SKIPPED: ${reason}`);
          processingLog.push({ rule: rule.name, status: 'skipped', reason });
          continue;
        }

        // ── Frequency check (weekly/monthly) ──
        const freq = config.frequency || 'daily';
        const istDayOfWeek = nowIST.getUTCDay();
        const istDayOfMonth = nowIST.getUTCDate();

        if (freq === 'weekly' && config.dayOfWeek !== undefined && config.dayOfWeek !== istDayOfWeek) {
          const reason = `Wrong day of week (need: ${config.dayOfWeek}, current IST: ${istDayOfWeek})`;
          console.log(`  → SKIPPED: ${reason}`);
          processingLog.push({ rule: rule.name, status: 'skipped', reason });
          continue;
        }
        if (freq === 'monthly' && config.dayOfMonth !== undefined && config.dayOfMonth !== istDayOfMonth) {
          const reason = `Wrong day of month (need: ${config.dayOfMonth}, current IST: ${istDayOfMonth})`;
          console.log(`  → SKIPPED: ${reason}`);
          processingLog.push({ rule: rule.name, status: 'skipped', reason });
          continue;
        }

        // ── Already-sent-today check (using IST date string comparison) ──
        if (rule.last_sent_at) {
          const lastSentUTC = new Date(rule.last_sent_at);
          const lastSentISTDate = getISTDateString(lastSentUTC);
          const todayISTDate = istDateStr;

          console.log(`  last_sent IST date: ${lastSentISTDate}`);
          console.log(`  today IST date:     ${todayISTDate}`);

          if (lastSentISTDate === todayISTDate) {
            const reason = `Already sent today (IST). last_sent_at=${rule.last_sent_at} → IST date: ${lastSentISTDate}`;
            console.log(`  → SKIPPED: ${reason}`);
            processingLog.push({ rule: rule.name, status: 'skipped', reason });
            continue;
          }
        }

        console.log(`  → WILL SEND: Time reached and not yet sent today`);
      } else {
        console.log(`  → WILL SEND: ${isForceRun ? 'Force run' : 'Non-scheduled trigger'}`);
      }

      // ── Generate report data ──
      let reportData: Record<string, string> = { date: format(nowIST, 'EEEE, MMMM do, yyyy') };
      if (rule.report_type === 'attendance_daily') {
        console.log(`  Generating daily attendance report...`);
        reportData = await generateDailyAttendanceReport(supabase, nowIST);
        console.log(`  Report generated: ${reportData.totalEmployees} employees, ${reportData.totalPresent} present`);
      } else if (rule.report_type === 'attendance_monthly') {
        reportData = { date: format(nowIST, 'yyyy-MM') };
      } else if (rule.report_type === 'document_expiry') {
        reportData = { date: format(nowIST, 'yyyy-MM-dd') };
      } else if (rule.report_type === 'pending_approvals') {
        reportData = { items: '0' };
      }

      // ── Render template ──
      const template = templateMap.get(rule.template_id);
      let subject = template?.subject_template || rule.name;
      let html = template?.body_template || getDefaultPremiumTemplate();

      subject = evaluateConditionals(subject, reportData);
      html = evaluateConditionals(html, reportData);

      const render = (text: string) => text.replace(/\{(\w+)\}/g, (match, key) => {
        const dataKey = Object.keys(reportData).find(k => k.toLowerCase() === key.toLowerCase());
        return dataKey ? reportData[dataKey] : match;
      });

      subject = render(subject);
      html = render(html);

      // ── Resolve recipients ──
      const emails = await resolveRecipients(supabase, rule);
      console.log(`  Recipients resolved: ${emails.length} email(s) → [${emails.join(', ')}]`);
      
      if (emails.length === 0) {
        const reason = 'No recipients found';
        console.log(`  → SKIPPED: ${reason}`);
        processingLog.push({ rule: rule.name, status: 'skipped', reason });
        continue;
      }

      // ── Send email via HTTP API (Deno Deploy blocks SMTP ports) ──
      try {
        await sendEmailViaHTTP(emailConfig, emails, subject, html, rule.id, rule.template_id);

        // Update last_sent_at and log
        await Promise.all([
          ...emails.map(email => supabase.from('email_logs').insert({ 
            rule_id: rule.id, 
            template_id: rule.template_id, 
            recipient_email: email, 
            subject, 
            status: 'sent' 
          })),
          supabase.from('email_schedule_rules').update({ 
            last_sent_at: now.toISOString() 
          }).eq('id', rule.id)
        ]);
        
        totalSent += emails.length;
        console.log(`  ✅ Rule "${rule.name}" completed. Sent to ${emails.length} recipients. last_sent_at updated.`);
        processingLog.push({ rule: rule.name, status: 'sent', recipients: emails.length });
      } catch (mailErr) {
        const errorMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
        const errorStack = mailErr instanceof Error ? mailErr.stack : '';
        console.error(`  ❌ MAIL FAILED for "${rule.name}":`, errorMsg);
        console.error(`  Stack:`, errorStack);
        processingLog.push({ rule: rule.name, status: 'failed', error: errorMsg });
        
        await Promise.all(emails.map(email => supabase.from('email_logs').insert({ 
          rule_id: rule.id, 
          template_id: rule.template_id, 
          recipient_email: email, 
          subject, 
          status: 'failed', 
          error_message: errorMsg 
        })));
      }
    }

    console.log(`\n[process-email-schedules] ═══════════════════════════════════════`);
    console.log(`[process-email-schedules] DONE. Total sent: ${totalSent}`);
    console.log(`[process-email-schedules] Summary:`, JSON.stringify(processingLog));

    return new Response(JSON.stringify({ 
      success: true, 
      sent: totalSent,
      timestamp_utc: now.toISOString(),
      timestamp_ist: `${istDateStr} ${String(istTime.hours).padStart(2,'0')}:${String(istTime.minutes).padStart(2,'0')}`,
      processing: processingLog
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';
    console.error(`[CRITICAL ERROR]`, errorMsg);
    console.error(`[CRITICAL STACK]`, errorStack);
    return new Response(JSON.stringify({ error: errorMsg, stack: errorStack }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─── Resolve Recipients ─────────────────────────────────────────────────────
async function resolveRecipients(supabase: ReturnType<typeof createClient>, rule: EmailScheduleRule): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []).eq('is_active', true);
    return (users || []).map((u: { email: string }) => u.email).filter(Boolean);
  }
  return (rule.recipient_type === 'users') ? (await supabase.from('users').select('email').in('id', rule.recipient_user_ids || [])).data?.map((u: { email: string }) => u.email).filter(Boolean) || [] : [];
}

// ─── Generate Daily Attendance Report ───────────────────────────────────────
async function generateDailyAttendanceReport(supabase: ReturnType<typeof createClient>, nowIST: Date): Promise<Record<string, string>> {
  const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - IST_OFFSET));
  const todayStr = format(nowIST, 'yyyy-MM-dd');

  const [settingsRes, usersRes, eventsRes, leavesRes] = await Promise.all([
    supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single(),
    supabase.from('users').select('id, name, role:roles(display_name)').eq('is_active', true).order('name'),
    supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', startOfTodayUTC.toISOString()).order('timestamp', { ascending: true }),
    supabase.from('leave_requests').select('user_id').eq('status', 'approved').lte('start_date', todayStr).gte('end_date', todayStr)
  ]);

  const configStartTime = settingsRes.data?.attendance_settings?.office?.fixedOfficeHours?.checkInTime || '09:30';
  const filteredUsers = ((usersRes.data || []) as User[]).filter((u: User) => {
    const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
    return roleName.toLowerCase() !== 'management';
  });
  const staffIds = new Set(filteredUsers.map((u: User) => u.id));
  const todayEvents = ((eventsRes.data || []) as AttendanceEvent[]).filter((e: AttendanceEvent) => staffIds.has(e.user_id));
  const onLeaveUserIds = new Set(((leavesRes.data || []) as LeaveRequest[]).map((l: LeaveRequest) => l.user_id));

  // 10-day lookback for inactivity
  const tenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - (9 * 24 * 60 * 60 * 1000));
  const { data: recentEvents } = await supabase.from('attendance_events').select('user_id').gte('timestamp', tenDaysAgoUTC.toISOString());
  const recentlyActiveUserIds = new Set(((recentEvents || []) as AttendanceEvent[]).map((e: AttendanceEvent) => e.user_id));

  const presentUserIds = new Set<string>();
  const userFirstPunches: Record<string, string> = {};
  todayEvents.forEach((e: AttendanceEvent) => {
    presentUserIds.add(e.user_id);
    if (e.type === 'punch-in' && !userFirstPunches[e.user_id]) userFirstPunches[e.user_id] = e.timestamp;
  });

  let lateCount = 0;
  Object.values(userFirstPunches).forEach(ts => {
    if (format(new Date(new Date(ts).getTime() + IST_OFFSET), 'HH:mm') > configStartTime) lateCount++;
  });

  const totalPresent = presentUserIds.size;
  const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
  const inactiveCount = Math.max(0, filteredUsers.length - recentlyActiveUserIds.size);
  const totalAbsent = Math.max(0, filteredUsers.length - totalPresent - onLeaveCount - inactiveCount);

  let tableHtml = '';
  filteredUsers.forEach((user: User, i: number) => {
    let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
    dept = dept.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    let status = 'Present', color = '#16a34a', pin = '—', pout = '—', wh = '—';
    if (presentUserIds.has(user.id)) {
      const inTs = userFirstPunches[user.id];
      const inDate = new Date(new Date(inTs).getTime() + IST_OFFSET);
      pin = format(inDate, 'hh:mm a');
      if (format(inDate, 'HH:mm') > configStartTime) { status = 'Late'; color = '#d97706'; }
      const lastOut = todayEvents.filter((e: AttendanceEvent) => e.user_id === user.id && e.type === 'punch-out').pop();
      if (lastOut) {
        pout = format(new Date(new Date(lastOut.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
        const diff = new Date(lastOut.timestamp).getTime() - new Date(inTs).getTime();
        wh = `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
      }
    } else if (onLeaveUserIds.has(user.id)) { status = 'On Leave'; color = '#2563eb'; }
    else if (recentlyActiveUserIds.has(user.id)) { status = 'Absent'; color = '#dc2626'; }
    else { status = 'Inactive'; color = '#9ca3af'; }

    tableHtml += `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
      <td style="border:1px solid #eee;padding:8px">${i+1}</td>
      <td style="border:1px solid #eee;padding:8px;font-weight:500">${user.name}</td>
      <td style="border:1px solid #eee;padding:8px">${dept}</td>
      <td style="border:1px solid #eee;padding:8px">${pin}</td>
      <td style="border:1px solid #eee;padding:8px">${pout}</td>
      <td style="border:1px solid #eee;padding:8px">${wh}</td>
      <td style="border:1px solid #eee;padding:8px;color:${color};font-weight:600">${status}</td>
    </tr>`;
  });

  return {
    date: format(nowIST, 'EEEE, MMMM do, yyyy'),
    generatedTime: format(nowIST, 'hh:mm a'),
    totalEmployees: String(filteredUsers.length),
    totalPresent: String(totalPresent),
    totalAbsent: String(totalAbsent),
    lateCount: String(lateCount),
    attendancePercentage: filteredUsers.length > 0 ? Math.round((totalPresent/filteredUsers.length)*100).toString() : '0',
    onLeaveCount: String(onLeaveCount),
    inactiveCount: String(inactiveCount),
    table: tableHtml || '<tr><td colspan="7">No data</td></tr>'
  };
}

// ─── Evaluate Conditionals ──────────────────────────────────────────────────
function evaluateConditionals(str: string, data: Record<string, string>) {
  return str.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (_m, key, op, val2Str, t, f) => {
    const v1 = parseFloat(data[Object.keys(data).find(k=>k.toLowerCase()===key.toLowerCase())||''] || '0');
    const v2 = parseFloat(val2Str);
    let ok = false;
    if(op==='>')ok=v1>v2; else if(op==='<')ok=v1<v2; else if(op==='>=')ok=v1>=v2; else if(op==='<=')ok=v1<=v2; else if(op==='==')ok=v1==v2; else if(op==='!=')ok=v1!=v2;
    return ok ? t : f;
  });
}

// ─── Default Template ───────────────────────────────────────────────────────
function getDefaultPremiumTemplate() {
  return `<div style="font-family:sans-serif;max-width:800px;margin:auto;border:1px solid #eee;padding:20px">
    <h2>Report: {date}</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f4f4f4"><th>Metric</th><th>Value</th></tr>
      <tr><td>Attendance</td><td>{attendancePercentage}%</td></tr>
      <tr><td>Present</td><td>{totalPresent}</td></tr>
      <tr><td>Absent</td><td>{totalAbsent}</td></tr>
    </table>
    <div style="margin-top:20px">{table}</div>
  </div>`;
}
