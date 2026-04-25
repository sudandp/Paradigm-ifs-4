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
    const { ruleId, force, test, testEmail } = body;

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
      
      const isForceRun = force === true || test === true || (ruleId !== undefined && ruleId === rule.id);

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

        if (freq === 'weekly') {
          const targetDay = config.dayOfWeek !== undefined ? config.dayOfWeek : 5; // Default to Friday
          if (targetDay !== istDayOfWeek) {
            const reason = `Wrong day of week (need: ${targetDay}, current IST: ${istDayOfWeek})`;
            console.log(`  → SKIPPED: ${reason}`);
            processingLog.push({ rule: rule.name, status: 'skipped', reason });
            continue;
          }
        }
        
        if (freq === 'monthly') {
          const targetDay = config.dayOfMonth !== undefined ? config.dayOfMonth : 1; // Default to 1st
          if (targetDay !== istDayOfMonth) {
            const reason = `Wrong day of month (need: ${targetDay}, current IST: ${istDayOfMonth})`;
            console.log(`  → SKIPPED: ${reason}`);
            processingLog.push({ rule: rule.name, status: 'skipped', reason });
            continue;
          }
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
        console.log(`  Generating monthly attendance report (Grid)...`);
        reportData = await generateMonthlyAttendanceReport(supabase, nowIST);
      } else if (rule.report_type === 'attendance_work_hours') {
        console.log(`  Generating work hours report (Grid)...`);
        reportData = await generateWorkHoursReport(supabase, nowIST);
      } else if (rule.report_type === 'attendance_site_ot') {
        console.log(`  Generating site OT report...`);
        reportData = await generateSiteOTReport(supabase, nowIST);
      } else if (rule.report_type === 'attendance_audit') {
        console.log(`  Generating audit log report...`);
        reportData = await generateAuditLogReport(supabase, nowIST);
      } else if (rule.report_type === 'document_expiry') {
        reportData = { date: format(nowIST, 'yyyy-MM-dd') };
      } else if (rule.report_type === 'pending_approvals') {
        reportData = { items: '0' };
      }

      // ── Render template ──
      const template = templateMap.get(rule.template_id);
      if (!template && !rule.report_type.startsWith('attendance')) {
          console.log(`  [WARN] No template found for rule "${rule.name}" (ID: ${rule.template_id})`);
      }

      let subject = template?.subject_template || rule.name;
      
      // Use premium template for monthly report if no database template exists or specifically requested
      let html = template?.body_template;
      if (!html || rule.report_type === 'attendance_monthly') {
        console.log(`  [INFO] Using default premium template for ${rule.report_type}`);
        html = (rule.report_type === 'attendance_monthly') ? getMonthlyReportPremiumTemplate() : getDefaultPremiumTemplate();
      }

      console.log(`  [DEBUG] reportData keys: ${Object.keys(reportData).join(', ')}`);

      // Helper to replace placeholders {Key} or {key}
      const render = (text: string, data: Record<string, string>) => {
        if (!text) return '';
        return text.replace(/\{(\w+)\}/g, (match, key) => {
          const dataKey = Object.keys(data).find(k => k.toLowerCase() === key.toLowerCase());
          if (dataKey) {
              console.log(`    Replacing {${key}} -> ${data[dataKey]}`);
              return data[dataKey];
          }
          return match;
        });
      };

      // Extract and process custom greeting message
      let greetingMessage = `Here is your automated status update for <strong>{date}</strong>. The data below reflects real-time triggers from the Paradigm system as of <strong>{generatedTime} IST</strong>.`;

      if (template?.variables && Array.isArray(template.variables)) {
        const customMsgObj = template.variables.find((v: any) => v.key === '_custom_message');
        if (customMsgObj && customMsgObj.description) {
            // First evaluate conditionals in the custom message
            let evaluatedMsg = evaluateConditionals(customMsgObj.description, reportData || {});
            
            // Replace newlines with <br/> for proper HTML rendering
            greetingMessage = evaluatedMsg.replace(/\n/g, '<br/>');
        }
      }
      
      // Inject the greeting into reportData so it can be evaluated in the template
      reportData.greetingMessage = greetingMessage;
      reportData.customGreeting = greetingMessage;

      // Force inject greeting if the user has a custom HTML body but didn't include either placeholder
      const hasGreetingPlaceholder = html.includes('{greetingMessage}') || html.includes('{customGreeting}');
      if (template?.body_template && !hasGreetingPlaceholder) {
          const greetingBlock = `\n<div style="font-family: Arial, sans-serif; padding: 0 0 20px 0; color: #333; font-size: 14px; line-height: 1.6; text-align: left;">\n  {greetingMessage}\n</div>\n`;
          if (html.match(/<body[^>]*>/i)) {
              html = html.replace(/(<body[^>]*>)/i, `$1${greetingBlock}`);
          } else {
              html = greetingBlock + html;
          }
      }

      // First pass: conditionals
      subject = evaluateConditionals(subject, reportData);
      html = evaluateConditionals(html, reportData || {});

      // Second pass: simple variable replacement
      subject = render(subject, reportData || {});
      html = render(html, reportData || {});

      // ── Resolve recipients ──
      let emails = await resolveRecipients(supabase, rule);
      
      // If this is a test and a specific test email was provided, use it
      if (test && typeof testEmail === 'string' && testEmail.includes('@')) {
        emails = [testEmail];
        console.log(`  [TEST MODE] Overriding recipients with ${testEmail}`);
      }


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
        const logTasks = emails.map(email => supabase.from('email_logs').insert({ 
          rule_id: rule.id, 
          template_id: rule.template_id, 
          recipient_email: email, 
          subject, 
          status: 'sent',
          trigger_type: test ? 'manual' : 'automatic'
        }));

        if (!test) {
          logTasks.push(supabase.from('email_schedule_rules').update({ 
            last_sent_at: now.toISOString() 
          }).eq('id', rule.id));
        }

        await Promise.all(logTasks);
        
        totalSent += emails.length;
        console.log(`  ✅ Rule "${rule.name}" completed. Sent to ${emails.length} recipients. ${test ? '(Test Only)' : 'last_sent_at updated.'}`);
        processingLog.push({ rule: rule.name, status: 'sent', recipients: emails.length });
      } catch (mailErr) {
        const errorMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
        console.error(`  ❌ MAIL FAILED for "${rule.name}":`, errorMsg);
        processingLog.push({ rule: rule.name, status: 'failed', error: errorMsg });
        
        await Promise.all(emails.map(email => supabase.from('email_logs').insert({ 
          rule_id: rule.id, 
          template_id: rule.template_id, 
          recipient_email: email, 
          subject, 
          status: 'failed', 
          error_message: errorMsg,
          trigger_type: test ? 'manual' : 'automatic'
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
    const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []);
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
    supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified').order('name'),
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

  if (totalPresent === 0 && onLeaveCount === 0 && !todayEvents.length) {
    return {
      date: format(nowIST, 'EEEE, MMMM do, yyyy'),
      generatedTime: format(nowIST, 'hh:mm a'),
      totalEmployees: String(filteredUsers.length),
      totalPresent: '0',
      totalAbsent: String(filteredUsers.length),
      lateCount: '0',
      attendancePercentage: '0',
      onLeaveCount: '0',
      inactiveCount: '0',
      table: `<tr><td colspan="7" style="padding: 24px; text-align: center; color: #64748b; background: #f8fafc;">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">No Attendance Activity Today</div>
        <div style="font-size: 12px; opacity: 0.8;">This could be due to a public holiday, weekend, or a sync issue with biometric devices.</div>
      </td></tr>`
    };
  }

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
    reportDate: format(nowIST, 'dd MMM yyyy'),
    generatedTime: format(nowIST, 'hh:mm a'),
    totalEmployees: String(filteredUsers.length),
    totalPresent: String(totalPresent),
    totalAbsent: String(totalAbsent),
    lateCount: String(lateCount),
    attendancePercentage: filteredUsers.length > 0 ? Math.round((totalPresent/filteredUsers.length)*100).toString() : '0',
    onLeaveCount: String(onLeaveCount),
    inactiveCount: String(inactiveCount),
    logo: '<img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;">',
    table: tableHtml || '<tr><td colspan="7">No data</td></tr>'
  };
}

// ─── Generate Monthly Attendance Report (Grid Style) ────────────────────────
// ─── Generate Monthly Attendance Report (Grid Style) ────────────────────────
async function generateMonthlyAttendanceReport(supabase: ReturnType<typeof createClient>, nowIST: Date): Promise<Record<string, string>> {
  const firstDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
  const lastDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth() + 1, 0);
  const monthStr = format(nowIST, 'MMMM yyyy');
  const daysInMonth = lastDayOfMonth.getDate();
  const today = new Date(nowIST.getTime());
  today.setUTCHours(0,0,0,0);

  const bufferStartDate = new Date(firstDayOfMonth);
  bufferStartDate.setDate(firstDayOfMonth.getDate() - 7);

  const [usersRes, eventsRes, leavesRes, settingsRes, holidaysRes, recurringHolidaysRes] = await Promise.all([
    supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified').order('name'),
    supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', bufferStartDate.toISOString()).lte('timestamp', lastDayOfMonth.toISOString()).order('timestamp', { ascending: true }),
    supabase.from('leave_requests').select('user_id, start_date, end_date, leave_type, status, day_option').eq('status', 'approved').gte('end_date', getISTDateString(bufferStartDate)).lte('start_date', getISTDateString(lastDayOfMonth)),
    supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single(),
    supabase.from('holidays').select('*').gte('date', getISTDateString(bufferStartDate)).lte('date', getISTDateString(lastDayOfMonth)),
    supabase.from('recurring_holidays').select('*')
  ]);

  const users = (usersRes.data || []) as User[];
  const events = (eventsRes.data || []) as AttendanceEvent[];
  const leaves = (leavesRes.data || []) as any[];
  const holidays = (holidaysRes.data || []) as any[];
  const recurringHolidays = (recurringHolidaysRes.data || []) as any[];
  const attendanceSettings = settingsRes.data?.attendance_settings;

  // Calculate aggregates for placeholders
  let totalPresentCount = 0;
  let totalAbsentCount = 0;
  let totalLateCount = 0;

  let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 10px; border: 1px solid #ddd;">
    <thead>
      <tr style="background: #f3f4f6; color: #111827; border-bottom: 2px solid #374151;">
        <th style="border: 1px solid #ccc; padding: 6px 4px; text-align: left; width: 140px;">Employee Name</th>`;
  
  for (let d = 1; d <= daysInMonth; d++) {
    tableHtml += `<th style="border: 1px solid #ccc; padding: 2px; text-align: center; width: 22px; font-size: 9px;">${d}</th>`;
  }
  tableHtml += `
        <th style="border: 1px solid #ccc; padding: 4px; text-align: center; background: #dcfce7; color: #166534; width: 30px;">P</th>
        <th style="border: 1px solid #ccc; padding: 4px; text-align: center; background: #fee2e2; color: #991b1b; width: 30px;">A</th>
        <th style="border: 1px solid #ccc; padding: 4px; text-align: center; background: #f3f4f6; color: #4b5563; width: 30px;">W/O</th>
        <th style="border: 1px solid #ccc; padding: 4px; text-align: center; background: #fef9c3; color: #854d0e; width: 30px;">H</th>
        <th style="border: 1px solid #ccc; padding: 4px; text-align: center; background: #374151; color: #fff; width: 40px; font-weight: bold;">Pay</th>
      </tr>
    </thead>
    <tbody>`;

  const configStartTime = attendanceSettings?.office?.fixedOfficeHours?.checkInTime || '09:30';

  users.forEach((user, idx) => {
    tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="border: 1px solid #ddd; padding: 6px 4px; font-weight: 500; font-size: 11px;">${user.name}</td>`;
    
    let userPresent = 0;
    let userHalfDay = 0;
    let userAbsent = 0;
    let userWeeklyOff = 0;
    let userHoliday = 0;
    let userPaidLeave = 0;

    let daysPresentInWeek = 0;
    // Overlapping week before month starts
    const startOfFirstWeek = new Date(firstDayOfMonth);
    startOfFirstWeek.setDate(firstDayOfMonth.getDate() - (firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1)); // Mon
    
    if (firstDayOfMonth > startOfFirstWeek) {
      let check = new Date(startOfFirstWeek);
      while (check < firstDayOfMonth) {
        const cStr = getISTDateString(check);
        if (check.getDay() === 0) {
          daysPresentInWeek = 0;
        } else {
          const dayEvs = events.filter(e => e.user_id === user.id && getISTDateString(new Date(e.timestamp)) === cStr);
          const dayLv = leaves.find(l => l.user_id === user.id && cStr >= l.start_date && cStr <= l.end_date);
          const isH = holidays.find(h => h.date === cStr);
          
          let worked = false;
          if (dayEvs.length > 0 || (dayLv && dayLv.leave_type?.toLowerCase() !== 'lop') || isH) {
            worked = true;
          }
          if (worked) daysPresentInWeek++;
        }
        check.setDate(check.getDate() + 1);
      }
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const currentDate = new Date(nowIST.getFullYear(), nowIST.getMonth(), d);
      const isMonday = currentDate.getDay() === 1;
      if (isMonday) daysPresentInWeek = 0;
      
      const isFuture = currentDate > today;
      const dateStr = getISTDateString(currentDate);
      const isSunday = currentDate.getDay() === 0;
      
      if (isFuture) {
        tableHtml += `<td style="border: 1px solid #eee; padding: 2px; text-align: center; color: #ccc;">—</td>`;
        continue;
      }

      const dayEvents = events.filter(e => e.user_id === user.id && getISTDateString(new Date(e.timestamp)) === dateStr);
      const dayLeave = leaves.find(l => l.user_id === user.id && dateStr >= l.start_date && dateStr <= l.end_date);
      const isPublicHoliday = holidays.find(h => h.date === dateStr);
      
      let status = '';
      let color = '#ccc';
      let bgColor = 'transparent';

      const punchIn = dayEvents.find(e => e.type === 'punch-in' || e.type === 'check_in');
      const punchOut = dayEvents.filter(e => e.type === 'punch-out' || e.type === 'check_out').pop();

      if (punchIn || punchOut) {
        const durationHours = (punchIn && punchOut) ? (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 3600000 : 0;
        const punchInTime = punchIn ? format(new Date(new Date(punchIn.timestamp).getTime() + IST_OFFSET), 'HH:mm') : '—';
        
        if (punchInTime !== '—' && punchInTime > configStartTime) totalLateCount++;

        if (durationHours >= 5 || (!punchOut && punchIn)) {
          status = 'P';
          color = '#16a34a';
          userPresent++;
          totalPresentCount++;
        } else if (durationHours > 1) {
          status = '1/2P';
          color = '#d97706';
          userHalfDay++;
          totalPresentCount += 0.5;
        } else {
          // One punch or short duration
          status = 'P';
          color = '#16a34a';
          userPresent++;
          totalPresentCount++;
        }
      } else if (dayLeave) {
        const isHalfDay = dayLeave.day_option === 'half';
        const leaveType = dayLeave.leave_type?.toLowerCase() || '';
        
        if (leaveType === 'loss of pay' || leaveType === 'lop') {
          status = isHalfDay ? '1/2A' : 'A';
          color = '#dc2626';
          userAbsent += isHalfDay ? 0.5 : 1;
          totalAbsentCount += isHalfDay ? 0.5 : 1;
        } else {
          status = isHalfDay ? '1/2L' : 'L';
          color = '#2563eb';
          userPaidLeave += isHalfDay ? 0.5 : 1;
        }
      } else if (isPublicHoliday) {
        status = 'H';
        color = '#854d0e';
        bgColor = '#fef9c3';
        userHoliday++;
      } else if (isSunday) {
        if (daysPresentInWeek >= 3) {
          status = 'WO';
          color = '#6b7280';
          userWeeklyOff++;
        } else {
          status = 'A';
          color = '#dc2626';
          userAbsent++;
          totalAbsentCount++;
        }
      } else {
        status = 'A';
        color = '#dc2626';
        userAbsent++;
        totalAbsentCount++;
      }

      if (['P', '1/2P', 'L', '1/2L', 'H'].some(s => status.includes(s))) {
        daysPresentInWeek++;
      }
      
      let bgColor = 'transparent';
      if (status === 'H') bgColor = '#fef9c3';
      else if (status === 'WO') bgColor = '#f3f4f6';
      else if (status === 'A') bgColor = '#fee2e2';

      tableHtml += `<td style="border: 1px solid #ddd; padding: 2px; text-align: center; color: ${color}; background: ${bgColor}; font-weight: bold; font-size: 9px;">${status || '—'}</td>`;
    }

    const payableDays = userPresent + (userHalfDay * 0.5) + userWeeklyOff + userHoliday + userPaidLeave;

    tableHtml += `
      <td style="border: 1px solid #ddd; padding: 4px; text-align: center; font-weight: bold; color: #16a34a;">${userPresent + (userHalfDay*0.5)}</td>
      <td style="border: 1px solid #ddd; padding: 4px; text-align: center; font-weight: bold; color: #dc2626;">${userAbsent}</td>
      <td style="border: 1px solid #ddd; padding: 4px; text-align: center; color: #6b7280;">${userWeeklyOff}</td>
      <td style="border: 1px solid #ddd; padding: 4px; text-align: center; color: #854d0e;">${userHoliday}</td>
      <td style="border: 1px solid #ddd; padding: 4px; text-align: center; font-weight: 800; background: #f3f4f6; color: #111827;">${payableDays}</td>
    </tr>`;
  });

  tableHtml += `</tbody></table>`;

  const totalEmployees = users.length;
  const daysSoFar = today.getDate();
  const totalPossibleDays = totalEmployees * daysSoFar;
  const attendancePercentage = totalPossibleDays > 0 ? Math.round((totalPresentCount / totalPossibleDays) * 100).toString() : '0';

  return {
    date: monthStr,
    reportDate: format(nowIST, 'dd MMM yyyy'),
    generatedTime: format(nowIST, 'hh:mm a'),
    totalEmployees: String(totalEmployees),
    totalPresent: String(Math.round(totalPresentCount)),
    totalAbsent: String(Math.round(totalAbsentCount)),
    lateCount: String(totalLateCount),
    attendancePercentage: attendancePercentage,
    logo: '<img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;">',
    table: tableHtml
  };
}

// ─── Generate Work Hours Report (Grid Style) ────────────────────────────────
async function generateWorkHoursReport(supabase: ReturnType<typeof createClient>, nowIST: Date): Promise<Record<string, string>> {
  const firstDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
  const lastDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth() + 1, 0);
  const monthStr = format(nowIST, 'MMMM yyyy');
  const daysInMonth = lastDayOfMonth.getDate();

  const [usersRes, eventsRes] = await Promise.all([
    supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified').order('name'),
    supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', firstDayOfMonth.toISOString()).lte('timestamp', lastDayOfMonth.toISOString()).order('timestamp', { ascending: true })
  ]);

  const users = (usersRes.data || []) as User[];
  const events = (eventsRes.data || []) as AttendanceEvent[];

  let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 8px; border: 1px solid #999;">
    <thead>
      <tr style="background: #111827; color: #fff;">
        <th style="border: 1px solid #555; padding: 4px; text-align: left; width: 120px;">Employee Name</th>`;
  
  for (let d = 1; d <= daysInMonth; d++) {
    tableHtml += `<th style="border: 1px solid #555; padding: 2px; text-align: center; width: 18px;">${d}</th>`;
  }
  tableHtml += `<th style="border: 1px solid #555; padding: 4px; text-align: center; background: #374151;">Total</th></tr></thead><tbody>`;

  users.forEach((user, idx) => {
    tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
      <td style="border: 1px solid #ddd; padding: 4px; font-weight: 500;">${user.name}</td>`;
    
    let totalMonthMinutes = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = format(new Date(nowIST.getFullYear(), nowIST.getMonth(), d), 'yyyy-MM-dd');
      const dayEvents = events.filter(e => e.user_id === user.id && getISTDateString(new Date(e.timestamp)) === dateStr);
      
      let dayMinutes = 0;
      const punchIn = dayEvents.find(e => e.type === 'punch-in' || e.type === 'check_in');
      const punchOut = dayEvents.filter(e => e.type === 'punch-out' || e.type === 'check_out').pop();

      if (punchIn && punchOut) {
        dayMinutes = (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 60000;
        totalMonthMinutes += dayMinutes;
      }

      const hours = dayMinutes > 0 ? (dayMinutes / 60).toFixed(1) : '-';
      tableHtml += `<td style="border: 1px solid #ddd; padding: 2px; text-align: center;">${hours}</td>`;
    }

    const totalHours = (totalMonthMinutes / 60).toFixed(1);
    tableHtml += `<td style="border: 1px solid #ddd; padding: 4px; text-align: center; font-weight: bold; background: #f3f4f6;">${totalHours}</td>
    </tr>`;
  });

  tableHtml += `</tbody></table>`;

  return {
    date: monthStr,
    totalEmployees: String(users.length),
    table: tableHtml
  };
}

// ─── Generate Site OT Report ────────────────────────────────────────────────
async function generateSiteOTReport(supabase: ReturnType<typeof createClient>, nowIST: Date): Promise<Record<string, string>> {
  const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - IST_OFFSET));
  const monthStr = format(nowIST, 'MMMM yyyy');

  const { data: usersData } = await supabase
    .from('users')
    .select(`
      id, 
      name, 
      monthly_ot_hours,
      site_assignments(site_id, organizations(name))
    `)
    .gt('monthly_ot_hours', 0);

  let tableHtml = `<table style="width:100%; border-collapse: collapse; font-size: 12px; border: 1px solid #ddd;">
    <thead>
      <tr style="background: #f3f4f6; color: #374151;">
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Employee</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Primary Site</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">OT Hours (Monthly)</th>
      </tr>
    </thead>
    <tbody>`;

  const users = (usersData || []) as any[];
  if (users.length === 0) {
    tableHtml += `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #666;">No overtime recorded for this period.</td></tr>`;
  } else {
    users.forEach((user, idx) => {
      const siteName = user.site_assignments?.[0]?.organizations?.name || 'Unassigned';
      tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
        <td style="border: 1px solid #ddd; padding: 8px; font-weight: 500;">${user.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${siteName}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; color: #d97706;">${user.monthly_ot_hours || 0}h</td>
      </tr>`;
    });
  }

  tableHtml += `</tbody></table>`;

  return {
    date: monthStr,
    totalStaffWithOT: String(users.length),
    table: tableHtml
  };
}

// ─── Generate Audit Log Report ──────────────────────────────────────────────
async function generateAuditLogReport(supabase: ReturnType<typeof createClient>, nowIST: Date): Promise<Record<string, string>> {
  const twentyFourHoursAgo = new Date(nowIST.getTime() - (24 * 60 * 60 * 1000));
  const dateStr = format(nowIST, 'EEEE, MMMM do, yyyy');

  const { data: logsData } = await supabase
    .from('attendance_audit_logs')
    .select('id, action, details, created_at, performed_by, target_user_id')
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .order('created_at', { ascending: false });

  const auditLogs = (logsData || []) as any[];
  
  // Fetch users involved in the logs to get names
  const userIds = new Set<string>();
  auditLogs.forEach(log => {
    if (log.performed_by) userIds.add(log.performed_by);
    if (log.target_user_id) userIds.add(log.target_user_id);
  });

  let userMap: Record<string, string> = {};
  if (userIds.size > 0) {
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name')
      .in('id', Array.from(userIds));
    usersData?.forEach(u => { userMap[u.id] = u.name; });
  }

  let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 11px; border: 1px solid #ddd;">
    <thead>
      <tr style="background: #f3f4f6; color: #374151;">
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Time</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Performed By</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Action</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Target</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Reason/Details</th>
      </tr>
    </thead>
    <tbody>`;

  if (auditLogs.length === 0) {
    tableHtml += `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #666;">No administrative changes in the last 24 hours.</td></tr>`;
  } else {
    auditLogs.forEach((log, idx) => {
      const time = format(new Date(new Date(log.created_at).getTime() + IST_OFFSET), 'hh:mm a');
      const details = log.details?.reason || log.details?.message || JSON.stringify(log.details);
      const performerName = userMap[log.performed_by] || 'System';
      const targetName = userMap[log.target_user_id] || '—';
      
      tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f9fafb'};">
        <td style="border: 1px solid #ddd; padding: 8px;">${time}</td>
        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${performerName}</td>
        <td style="border: 1px solid #ddd; padding: 8px;"><span style="padding: 2px 6px; background: #fee2e2; color: #991b1b; border-radius: 4px; text-transform: uppercase; font-size: 9px;">${log.action}</span></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${targetName}</td>
        <td style="border: 1px solid #ddd; padding: 8px; color: #666;">${details}</td>
      </tr>`;
    });
  }

  tableHtml += `</tbody></table>`;

  return {
    date: dateStr,
    logCount: String(auditLogs.length),
    table: tableHtml
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
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media only screen and (max-width: 600px) {
      .stats-container { display: block !important; }
      .stat-card { margin-bottom: 12px !important; width: 100% !important; }
      .header-content { display: block !important; text-align: center !important; }
      .header-right { text-align: center !important; margin-top: 12px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9;">
  <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px; color: white;">
      <div class="header-content" style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <!-- Logo Placeholder -->
          <div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);">
            <img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;" onerror="this.style.display='none'">
            <span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-left: 2px;">PARADIGM</span>
          </div>
        </div>
        <div class="header-right" style="text-align: right;">
          <div style="font-size: 11px; opacity: 0.7; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Attendance Management System</div>
          <div style="font-size: 16px; font-weight: 600;">{reportDate}</div>
        </div>
      </div>
    </div>
    
    <div style="padding: 32px;">
      <!-- Greeting / Meta -->
      <div style="margin-bottom: 32px;">
        <div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Hi,</div>
        <p style="margin: 0; color: #64748b; font-size: 15px; line-height: 1.6;">
          {greetingMessage}
        </p>
      </div>

      <!-- Stats Grid -->
      <div class="stats-container" style="display: flex; gap: 16px; margin-bottom: 32px;">
        <div class="stat-card" style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Staff Presence</div>
          <div style="font-size: 28px; font-weight: 800; color: #059669;">{attendancePercentage}%</div>
        </div>
        <div class="stat-card" style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Total Present</div>
          <div style="font-size: 28px; font-weight: 800; color: #10b981;">{totalPresent}</div>
        </div>
        <div class="stat-card" style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center;">
          <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Total Late</div>
          <div style="font-size: 28px; font-weight: 800; color: #f59e0b;">{lateCount}</div>
        </div>
      </div>

      <!-- Table Section -->
      <div style="margin-bottom: 32px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="background: #f8fafc; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;">
          <h3 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 700;">Detailed Overview</h3>
        </div>
        <div style="overflow-x: auto;">
          {table}
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-bottom: 40px;">
        <a href="https://app.paradigmfms.com" style="display: inline-block; background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
          Open System Dashboard
        </a>
      </div>

      <!-- Footer -->
      <div style="padding-top: 32px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.8;">
        <div style="margin-bottom: 8px; font-weight: 600; color: #64748b;">Paradigm Facility Management Services</div>
        <div style="margin-bottom: 16px;">This is a system-generated secure audit report. No reply is required.</div>
        <div style="display: inline-flex; gap: 8px; justify-content: center;">
          <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 6px;">Timezone: IST</span>
          <span style="background: #f1f5f9; padding: 4px 8px; border-radius: 6px;">Report ID: #PRD-{generatedTime}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function getMonthlyReportPremiumTemplate() {
  return getDefaultPremiumTemplate(); // Already premium now
}

