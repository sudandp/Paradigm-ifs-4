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

      // ══ NEW REPORT TYPES ══════════════════════════════════════════════════

      // HRM reports
      } else if (rule.report_type === 'hrm_leave_summary') {
        console.log(`  Generating HRM leave summary...`);
        reportData = await generateHRMLeaveReport(supabase, nowIST);
      } else if (rule.report_type === 'hrm_new_joiners') {
        console.log(`  Generating HRM new joiners report...`);
        reportData = await generateHRMNewJoinersReport(supabase, nowIST);
      } else if (rule.report_type === 'hrm_pending_approvals') {
        console.log(`  Generating HRM pending approvals report...`);
        reportData = await generateHRMPendingApprovalsReport(supabase, nowIST);
      } else if (rule.report_type === 'hrm_payroll_snapshot') {
        console.log(`  Generating HRM payroll snapshot...`);
        reportData = await generateHRMPayrollSnapshot(supabase, nowIST);

      // CRM reports
      } else if (rule.report_type === 'crm_bd_daily' || rule.report_type === 'bd_daily') {
        console.log(`  Generating CRM BD Daily report...`);
        reportData = await generateCRMBdDailyReport(supabase, nowIST);
      } else if (rule.report_type === 'crm_daily_pipeline') {
        console.log(`  Generating CRM daily pipeline report...`);
        reportData = await generateCRMDailyPipelineReport(supabase, nowIST);
      } else if (rule.report_type === 'crm_weekly_sales') {
        console.log(`  Generating CRM weekly sales report...`);
        reportData = await generateCRMWeeklySalesReport(supabase, nowIST);
      } else if (rule.report_type === 'crm_lead_aging') {
        console.log(`  Generating CRM lead aging report...`);
        reportData = await generateCRMLeadAgingReport(supabase, nowIST);

      // Operations reports
      } else if (rule.report_type === 'ops_task_summary') {
        console.log(`  Generating Ops task summary report...`);
        reportData = await generateOpsTaskSummary(supabase, nowIST);
      } else if (rule.report_type === 'ops_site_activity') {
        console.log(`  Generating Ops site activity report...`);
        reportData = await generateOpsSiteActivityReport(supabase, nowIST);
      }


      // ── Render template ──
      const template = templateMap.get(rule.template_id);
      if (!template && !rule.report_type.startsWith('attendance')) {
          console.log(`  [WARN] No template found for rule "${rule.name}" (ID: ${rule.template_id})`);
      }

      const reportDataList: Record<string, string>[] = Array.isArray(reportData) ? reportData : [reportData];

      for (const dataItem of reportDataList) {
        let subject = template?.subject_template || rule.name;
        
        // Use premium template for monthly report if no database template exists
        let html = template?.body_template;
        if (!html) {
          console.log(`  [INFO] Using default premium template for ${rule.report_type}`);
          html = (rule.report_type === 'attendance_monthly') ? getMonthlyReportPremiumTemplate() : getDefaultPremiumTemplate();
        }

        console.log(`  [DEBUG] dataItem keys: ${Object.keys(dataItem).join(', ')}`);

        // Helper to replace placeholders {Key} or {key}
        const render = (text: string, data: Record<string, string>) => {
          if (!text) return '';
          return text.replace(/\{(\w+)\}/g, (match, key) => {
            // Flexible key matching: case-insensitive and ignoring underscores/dashes
            const cleanKey = key.toLowerCase().replace(/[_-]/g, '');
            const dataKey = Object.keys(data).find(k => {
                const cleanK = k.toLowerCase().replace(/[_-]/g, '');
                return cleanK === cleanKey;
            });
            
            if (dataKey) {
                return data[dataKey];
            }
            return match;
          });
        };

        // Extract and process custom greeting message
        let greetingMessage = `Here is your automated status update for <strong>{date}</strong>. The data below reflects real-time triggers from the Paradigm system as of <strong>{generatedTime} IST</strong>.`;

        // Premium Greeting Logic (Synced with Test logic)
        if (rule.report_type === 'attendance_monthly') {
            greetingMessage = `Dear Management,<br/><br/>This is the consolidated attendance summary for the period of <strong>{date}</strong>. It covers overall employee presence across all <strong>{totalEmployees}</strong> active members of the staff.<br/><br/>Overall attendance stands at <strong>{attendancePercentage}%</strong>. Please review the detailed monthly attendance grid below for any discrepancies.`;
        } else if (rule.report_type === 'attendance_daily') {
            greetingMessage = `Dear Team,<br/><br/>Today's attendance stands at <strong>{attendancePercentage}%</strong>. A total of <strong>{totalAbsent}</strong> employees were absent, and <strong>{lateCount}</strong> reported late.<br/><br/>Attendance requires attention.`;
        } else if (rule.report_type === 'crm_bd_daily' || rule.report_type === 'bd_daily') {
            greetingMessage = `Dear Management,<br/><br/>Daily Activity Report for <strong>{bd_name}</strong> for <strong>{report_date}</strong>.`;
        }

        // Check for template-specific custom message override
        if (template?.variables && Array.isArray(template.variables)) {
          const customMsgObj = template.variables.find((v: any) => v.key === '_custom_message');
          if (customMsgObj && customMsgObj.description && customMsgObj.description.trim()) {
              // First evaluate conditionals in the custom message
              let evaluatedMsg = evaluateConditionals(customMsgObj.description, dataItem || {});
              
              // Replace newlines with <br/> for proper HTML rendering
              greetingMessage = evaluatedMsg.replace(/\n/g, '<br/>');
          }
        }
        
        // CRITICAL: Render the greeting message itself with available dataItem 
        greetingMessage = render(greetingMessage, dataItem || {});
        
        // Inject the greeting into dataItem so it can be evaluated in the template
        dataItem.greetingMessage = greetingMessage;
        dataItem.customGreeting = greetingMessage;
        dataItem.greeting_message = greetingMessage;
        dataItem.custom_greeting = greetingMessage;
        dataItem.summary = greetingMessage;

        // Force inject greeting if the user has a custom HTML body but didn't include a placeholder
        const hasGreetingPlaceholder = html.includes('{greetingMessage}') || 
                                       html.includes('{customGreeting}') || 
                                       html.includes('{greeting_message}') || 
                                       html.includes('{custom_greeting}') ||
                                       html.includes('{summary}');
                                       
        if (template?.body_template && !hasGreetingPlaceholder && !rule.report_type.includes('bd_daily')) {
            const greetingBlock = `\n<div style="font-family: Arial, sans-serif; padding: 0 0 20px 0; color: #333; font-size: 14px; line-height: 1.6; text-align: left;">\n  {greetingMessage}\n</div>\n`;
            if (html.match(/<body[^>]*>/i)) {
                html = html.replace(/(<body[^>]*>)/i, `$1${greetingBlock}`);
            } else {
                html = greetingBlock + html;
            }
        }

        // First pass: conditionals
        subject = evaluateConditionals(subject, dataItem);
        html = evaluateConditionals(html, dataItem || {});

        // Second pass: simple variable replacement
        subject = render(subject, dataItem || {});
        html = render(html, dataItem || {});

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
      year: format(nowIST, 'yyyy'),
      totalEmployees: String(filteredUsers.length),
      totalPresent: '0',
      totalAbsent: String(filteredUsers.length),
      lateCount: '0',
      attendancePercentage: '0',
      onLeaveCount: '0',
      inactiveCount: '0',
      table: `<tr><td colspan="11" style="padding: 24px; text-align: center; color: #64748b; background: #f8fafc;">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">No Attendance Activity Today</div>
        <div style="font-size: 12px; opacity: 0.8;">This could be due to a public holiday, weekend, or a sync issue with biometric devices.</div>
      </td></tr>`
    };
  }

  let tableHtml = '';
  filteredUsers.forEach((user: User, i: number) => {
    let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
    dept = dept.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    let status = 'Present', color = '#16a34a', pin = '—', pout = '—', bin = '—', bout = '—', otin = '—', otout = '—', wh = '—';
    if (presentUserIds.has(user.id)) {
      const userEvents = todayEvents.filter((e: AttendanceEvent) => e.user_id === user.id);
      const inTs = userFirstPunches[user.id];
      const inDate = new Date(new Date(inTs).getTime() + IST_OFFSET);
      pin = format(inDate, 'hh:mm a');
      if (format(inDate, 'HH:mm') > configStartTime) { status = 'Late'; color = '#d97706'; }
      
      const lastOut = userEvents.filter((e: AttendanceEvent) => e.type === 'punch-out').pop();
      if (lastOut) {
        pout = format(new Date(new Date(lastOut.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
        const diff = new Date(lastOut.timestamp).getTime() - new Date(inTs).getTime();
        wh = `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
      }

      // Fetch Breaks
      const firstBIn = userEvents.find((e: AttendanceEvent) => e.type === 'break-in');
      const lastBOut = userEvents.filter((e: AttendanceEvent) => e.type === 'break-out').pop();
      if (firstBIn) bin = format(new Date(new Date(firstBIn.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
      if (lastBOut) bout = format(new Date(new Date(lastBOut.timestamp).getTime() + IST_OFFSET), 'hh:mm a');

      // Fetch Site OT
      const firstOTIn = userEvents.find((e: AttendanceEvent) => e.type === 'site-ot-in');
      const lastOTOut = userEvents.filter((e: AttendanceEvent) => e.type === 'site-ot-out').pop();
      if (firstOTIn) otin = format(new Date(new Date(firstOTIn.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
      if (lastOTOut) otout = format(new Date(new Date(lastOTOut.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
    } else if (onLeaveUserIds.has(user.id)) { status = 'On Leave'; color = '#2563eb'; }
    else if (recentlyActiveUserIds.has(user.id)) { status = 'Absent'; color = '#dc2626'; }
    else { status = 'Inactive'; color = '#9ca3af'; }

    tableHtml += `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
      <td style="border:1px solid #eee;padding:8px">${i+1}</td>
      <td style="border:1px solid #eee;padding:8px;font-weight:500">${user.name}</td>
      <td style="border:1px solid #eee;padding:8px">${dept}</td>
      <td style="border:1px solid #eee;padding:8px">${pin}</td>
      <td style="border:1px solid #eee;padding:8px">${pout}</td>
      <td style="border:1px solid #eee;padding:8px">${bin}</td>
      <td style="border:1px solid #eee;padding:8px">${bout}</td>
      <td style="border:1px solid #eee;padding:8px">${otin}</td>
      <td style="border:1px solid #eee;padding:8px">${otout}</td>
      <td style="border:1px solid #eee;padding:8px">${wh}</td>
      <td style="border:1px solid #eee;padding:8px;color:${color};font-weight:600">${status}</td>
    </tr>`;
  });

  return {
    date: format(nowIST, 'EEEE, MMMM do, yyyy'),
    reportDate: format(nowIST, 'dd MMM yyyy'),
    generatedTime: format(nowIST, 'hh:mm a'),
    year: format(nowIST, 'yyyy'),
    totalEmployees: String(filteredUsers.length),
    totalPresent: String(totalPresent),
    totalAbsent: String(totalAbsent),
    lateCount: String(lateCount),
    attendancePercentage: filteredUsers.length > 0 ? Math.round((totalPresent/filteredUsers.length)*100).toString() : '0',
    onLeaveCount: String(onLeaveCount),
    inactiveCount: String(inactiveCount),
    logo: '<img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;">',
    table: tableHtml || '<tr><td colspan="11">No data</td></tr>'
  };
}

// ─── Generate Monthly Attendance Report (Grid Style) ────────────────────────
// ─── Generate Monthly Attendance Report (Grid Style) ────────────────────────
async function generateMonthlyAttendanceReport(supabase: ReturnType<typeof createClient>, nowIST: Date): Promise<Record<string, string>> {
  const targetDate = new Date(nowIST.getFullYear(), nowIST.getMonth() - 1, 1);
  const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
  const monthStr = format(targetDate, 'MMMM yyyy');
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

    let tableHtml = `<style>
.report-grid { width: 100%; border-collapse: collapse; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 8px; border: 1px solid #e2e8f0; }
.report-grid th { border: 1px solid #e2e8f0; padding: 6px 3px; font-weight: 700; background-color: #f8fafc; color: #1e293b; }
.report-grid td { border: 1px solid #e2e8f0; padding: 4px 2px; text-align: center; color: #334155; }
.report-grid td.emp-name { text-align: left; font-weight: 600; min-width: 120px; padding: 6px 6px; color: #0f172a; }
.report-grid td.p { color: #166534; font-weight: bold; background-color: #f0fdf4; }
.report-grid td.a { color: #991b1b; background-color: #fef2f2; }
.report-grid td.wo { color: #4b5563; background-color: #f9fafb; }
.report-grid td.h { color: #854d0e; background-color: #fffbeb; font-weight: bold; }
.report-grid td.hd { color: #92400e; background-color: #fffbeb; font-weight: bold; }
.report-grid td.ot { color: #075985; background-color: #f0f9ff; font-weight: bold; }
.report-grid td.co { color: #9d174d; background-color: #fdf2f8; font-weight: bold; }
.report-grid td.el { color: #5b21b6; background-color: #f5f3ff; font-weight: bold; }
.report-grid td.sl { color: #9f1239; background-color: #fff1f2; font-weight: bold; }
.report-grid td.tot { font-weight: 800; background-color: #ecfdf5; color: #065f46; border-left: 2px solid #10b981; }
.report-grid tr.even { background-color: #ffffff; }
.report-grid tr.odd { background-color: #f8fafc; }
</style>
<table class="report-grid">
    <thead>
      <tr style="background: #f8fafc; color: #1e293b; border-bottom: 2px solid #e2e8f0;">
        <th style="border: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; min-width: 140px; font-weight: 700;">Employee Name</th>`;
  
  for (let d = 1; d <= daysInMonth; d++) {
    tableHtml += `<th style="border: 1px solid #e2e8f0; padding: 4px 2px; text-align: center; width: 22px; font-size: 9px; font-weight: 600;">${d}</th>`;
  }
  tableHtml += `
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f0fdf4; color: #166534; width: 25px; font-weight: 700;">P</th>
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fffbeb; color: #92400e; width: 35px; font-weight: 700;">0.5P</th>
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f0f9ff; color: #075985; width: 25px; font-weight: 700;">OT</th>
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fdf2f8; color: #9d174d; width: 25px; font-weight: 700;">C/O</th>
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f5f3ff; color: #5b21b6; width: 25px; font-weight: 700;">E/L</th>
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fff1f2; color: #9f1239; width: 25px; font-weight: 700;">S/L</th>
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fef2f2; color: #991b1b; width: 25px; font-weight: 700;">A</th>
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #f9fafb; color: #4b5563; width: 30px; font-weight: 700;">W/O</th>
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #fffbeb; color: #854d0e; width: 25px; font-weight: 700;">H</th>
        <th style="border: 1px solid #e2e8f0; padding: 4px; text-align: center; background: #ecfdf5; color: #065f46; width: 35px; font-weight: 800; border-left: 2px solid #10b981;">Pay</th>
      </tr>
    </thead>
    <tbody>`;

  const configStartTime = attendanceSettings?.office?.fixedOfficeHours?.checkInTime || '09:30';

    users.forEach((user, idx) => {
    tableHtml += `<tr class="${idx % 2 === 0 ? 'even' : 'odd'}">
      <td class="emp-name">${user.name}</td>`;
    
    let countP = 0;
    let countHalfP = 0;
    let countOT = 0;
    let countCO = 0;
    let countEL = 0;
    let countSL = 0;
    let countA = 0;
    let countWO = 0;
    let countH = 0;
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
        tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 2px; text-align: center; color: #ccc; font-size: 8px;">—</td>`;
        continue;
      }

      const dayEvents = events.filter(e => e.user_id === user.id && getISTDateString(new Date(e.timestamp)) === dateStr);
      const dayLeave = leaves.find(l => l.user_id === user.id && dateStr >= l.start_date && dateStr <= l.end_date);
      const isPublicHoliday = holidays.find(h => h.date === dateStr);
      
      let status = '';
      let color = '#64748b';
      let cellBg = 'transparent';

      const punchIn = dayEvents.find(e => e.type === 'punch-in' || e.type === 'check_in');
      const punchOut = dayEvents.filter(e => e.type === 'punch-out' || e.type === 'check_out').pop();

      if (punchIn || punchOut) {
        const durationHours = (punchIn && punchOut) ? (new Date(punchOut.timestamp).getTime() - new Date(punchIn.timestamp).getTime()) / 3600000 : 0;
        const punchInTime = punchIn ? format(new Date(new Date(punchIn.timestamp).getTime() + IST_OFFSET), 'HH:mm') : '—';
        
        if (punchInTime !== '—' && punchInTime > configStartTime) totalLateCount++;

        let baseStatus = '';
        if (durationHours >= 5 || (!punchOut && punchIn)) {
          baseStatus = 'P';
        } else {
          baseStatus = '0.5P';
        }

        const isHalfDayLeave = dayLeave && dayLeave.day_option === 'half';
        
        if (baseStatus === '0.5P' && isHalfDayLeave) {
          const leaveType = dayLeave.leave_type?.toLowerCase() || '';
          let code = 'EL';
          if (leaveType.includes('sick')) code = 'SL';
          else if (leaveType.includes('comp') || leaveType.includes('c/o')) code = 'CO';
          else if (leaveType.includes('casual')) code = 'CL';
          
          status = `0.5P+0.5 ${code}`;
          color = '#2563eb';
          cellBg = '#f5f3ff';
          countHalfP++;
          totalPresentCount += 0.5;
          userPaidLeave += 0.5;
        } else {
          status = baseStatus;
          color = baseStatus === 'P' ? '#16a34a' : '#d97706';
          cellBg = baseStatus === 'P' ? '#f0fdf4' : '#fffbeb';
          if (baseStatus === 'P') {
            countP++;
            totalPresentCount++;
          } else {
            countHalfP++;
            totalPresentCount += 0.5;
          }
        }
      } else if (dayLeave) {
        const isHalfDay = dayLeave.day_option === 'half';
        const leaveType = dayLeave.leave_type?.toLowerCase() || '';
        if (leaveType === 'loss of pay' || leaveType === 'lop') {
          status = isHalfDay ? '0.5A' : 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA += isHalfDay ? 0.5 : 1; totalAbsentCount += isHalfDay ? 0.5 : 1;
        } else {
          if (leaveType.includes('sick')) { status = isHalfDay ? '0.5SL' : 'SL'; countSL += isHalfDay ? 0.5 : 1; cellBg = '#fff1f2'; }
          else if (leaveType.includes('earned') || leaveType.includes('annual')) { status = isHalfDay ? '0.5EL' : 'EL'; countEL += isHalfDay ? 0.5 : 1; cellBg = '#f5f3ff'; }
          else if (leaveType.includes('comp') || leaveType.includes('c/o')) { status = isHalfDay ? '0.5CO' : 'CO'; countCO += isHalfDay ? 0.5 : 1; cellBg = '#fdf2f8'; }
          else { status = isHalfDay ? '0.5L' : 'L'; cellBg = '#eff6ff'; }
          color = '#2563eb';
          userPaidLeave += isHalfDay ? 0.5 : 1;
        }
      } else if (isPublicHoliday) {
        status = 'H'; color = '#854d0e'; cellBg = '#fef3c7'; countH++;
      } else if (isSunday) {
        if (daysPresentInWeek >= 3) {
          status = 'W/O'; color = '#64748b'; cellBg = '#f1f5f9'; countWO++;
        } else {
          status = 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA++; totalAbsentCount++;
        }
      } else {
        status = 'A'; color = '#dc2626'; cellBg = '#fef2f2'; countA++; totalAbsentCount++;
      }

      if (['P', '0.5P', 'L', 'EL', 'SL', 'CO', 'C/O', 'H'].some(s => status.includes(s))) {
        daysPresentInWeek++;
      }
      
      let cellClass = "";
      if (status === 'P') cellClass = 'class="p"';
      else if (status === 'A') cellClass = 'class="a"';
      else if (status === 'W/O' || status === 'WO') cellClass = 'class="wo"';
      else if (status === 'H') cellClass = 'class="h"';
      else if (status.includes('0.5')) cellClass = 'class="hd"';
      else if (status.includes('SL')) cellClass = 'class="sl"';
      else if (status.includes('EL')) cellClass = 'class="el"';
      else if (status.includes('CO') || status.includes('C/O')) cellClass = 'class="co"';
      else if (status === '—') cellClass = '';
      else cellClass = `style="color: ${color}; background: ${cellBg}; font-weight: 700;"`;

      tableHtml += `<td ${cellClass}>${status || '—'}</td>`;
    }

    const payableDays = countP + (countHalfP * 0.5) + countWO + countH + userPaidLeave;

    tableHtml += `
      <td class="p">${countP}</td>
      <td class="hd">${countHalfP}</td>
      <td class="ot">${countOT}</td>
      <td class="co">${countCO}</td>
      <td class="el">${countEL}</td>
      <td class="sl">${countSL}</td>
      <td class="a">${countA}</td>
      <td class="wo">${countWO}</td>
      <td class="h">${countH}</td>
      <td class="tot">${payableDays}</td>
    </tr>`;
  });

  tableHtml += `</tbody></table>`;
  
  // Add Legend (matches Image 2)
  tableHtml += `
  <div style="margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; font-family: sans-serif;">
    <table style="width: 100%; border-collapse: collapse; text-align: center;">
      <tr>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #166534; font-weight: bold;">P:</span> PRESENT</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #991b1b; font-weight: bold;">A:</span> ABSENT</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #991b1b; font-weight: bold;">LOP:</span> LOSS OF PAY</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #92400e; font-weight: bold;">0.5P:</span> HALF DAY</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #155e75; font-weight: bold;">W/H:</span> WFH</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #0c4a6e; font-weight: bold;">W/P:</span> WEEK OFF WORK</td>
      </tr>
      <tr>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #475569; font-weight: bold;">W/O:</span> WEEKLY OFF</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #b45309; font-weight: bold;">H:</span> HOLIDAY</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #0369a1; font-weight: bold;">OT(P):</span> OT / EXTRAP</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #6d28d9; font-weight: bold;">S/L:</span> SICK LEAVE</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #4338ca; font-weight: bold;">E/L:</span> EARNED LEAVE</td>
        <td style="padding: 5px; font-size: 10px; color: #64748b;"><span style="color: #be185d; font-weight: bold;">C/O:</span> COMP OFF</td>
      </tr>
    </table>
    <div style="text-align: center; margin-top: 15px; font-size: 10px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Paradigm Services - Monthly Status Report</div>
  </div>`;

  const totalEmployees = users.length;
  const daysSoFar = today.getDate();
  const totalPossibleDays = totalEmployees * daysSoFar;
  const attendancePercentage = totalPossibleDays > 0 ? Math.round((totalPresentCount / totalPossibleDays) * 100).toString() : '0';

  const billingCycle = `01 ${format(targetDate, 'MMM yyyy')} - ${daysInMonth} ${format(targetDate, 'MMM yyyy')}`;

  return {
    date: monthStr,
    billingCycle: billingCycle,
    reportDate: format(nowIST, 'dd MMM yyyy'),
    generatedTime: format(nowIST, 'HH:mm'),
    year: format(nowIST, 'yyyy'),
    totalEmployees: String(totalEmployees),
    totalPresent: String(Math.round(totalPresentCount)),
    totalAbsent: String(Math.round(totalAbsentCount)),
    lateCount: String(totalLateCount),
    attendancePercentage: attendancePercentage,
    logo: '<img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Logo" style="height: 40px; display: block;">',
    table: tableHtml,
    generatedBy: 'System Admin'
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
    const cleanKey = key.toLowerCase().replace(/[_-]/g, '');
    const dataKey = Object.keys(data).find(k => k.toLowerCase().replace(/[_-]/g, '') === cleanKey);
    const v1 = parseFloat(dataKey ? data[dataKey] : '0');
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
        <div style="overflow-x: auto;" class="attendance-table">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">S.No</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Employee Name</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Dept</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">In</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Out</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">B.In</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">B.Out</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">OT.In</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">OT.Out</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Dur</th>
                <th style="padding: 12px 4px; text-align: left; font-size: 10px; color: #64748b; font-weight: 600;">Status</th>
              </tr>
            </thead>
            <tbody>
              {table}
            </tbody>
          </table>
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
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @media only screen and (max-width: 600px) {
      .stats-container { display: block !important; }
      .stat-card { margin-bottom: 16px !important; width: 100% !important; }
      .header-content { display: block !important; text-align: center !important; }
      .header-right { text-align: center !important; margin-top: 20px !important; }
      .logo-container { justify-content: center !important; margin-bottom: 12px !important; }
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    table { width: 100%; border-collapse: collapse; }
    .report-grid { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .report-grid th { padding: 12px 6px; font-weight: 600; background-color: #f8fafc; color: #475569; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
    .report-grid td { padding: 10px 4px; text-align: center; color: #334155; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; font-weight: 500; }
    .report-grid td:last-child, .report-grid th:last-child { border-right: none; }
    .report-grid tr:last-child td { border-bottom: none; }
    .report-grid td.emp-name { text-align: left; font-weight: 600; min-width: 150px; padding: 10px 14px; color: #0f172a; }
    
    /* Softened Status Colors */
    .report-grid td.p { color: #059669; font-weight: 700; background-color: rgba(16, 185, 129, 0.08); }
    .report-grid td.a { color: #dc2626; background-color: rgba(239, 68, 68, 0.08); }
    .report-grid td.wo { color: #64748b; background-color: #f1f5f9; }
    .report-grid td.h { color: #d97706; background-color: rgba(245, 158, 11, 0.08); font-weight: 700; }
    .report-grid td.hd { color: #ea580c; background-color: rgba(249, 115, 22, 0.08); font-weight: 700; }
    .report-grid td.ot { color: #0284c7; background-color: rgba(14, 165, 233, 0.08); font-weight: 700; }
    .report-grid td.co { color: #db2777; background-color: rgba(236, 72, 153, 0.08); font-weight: 700; }
    .report-grid td.el { color: #7c3aed; background-color: rgba(139, 92, 246, 0.08); font-weight: 700; }
    .report-grid td.sl { color: #e11d48; background-color: rgba(225, 29, 72, 0.08); font-weight: 700; }
    .report-grid td.tot { font-weight: 800; background-color: #f0fdf4; color: #047857; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4fbf7; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 1000px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(4, 120, 87, 0.08), 0 0 0 1px rgba(4,120,87,0.02);">
    
    <!-- Premium Green Header -->
    <div style="background: linear-gradient(135deg, #065f46 0%, #10b981 100%); padding: 48px 40px; color: white;">
      <div style="display: flex; justify-content: space-between; align-items: center;" class="header-content">
        <div>
          <div class="logo-container" style="display: flex; align-items: center; margin-bottom: 12px;">
            <div style="background: white; padding: 10px 14px; border-radius: 12px; display: inline-flex; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm Services" style="height: 36px; display: block;">
            </div>
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #a7f3d0; text-transform: uppercase; letter-spacing: 2px;">Paradigm Services</div>
        </div>
        <div style="text-align: right;" class="header-right">
          <h1 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: white;">Monthly Attendance</h1>
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.15); padding: 8px 16px; border-radius: 20px; font-size: 15px; font-weight: 600; color: #ffffff; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2);">
            {date}
          </div>
        </div>
      </div>
    </div>

    <div style="padding: 40px;">
      <!-- Greeting Block -->
      <div style="margin-bottom: 40px; padding: 24px; background: #f0fdf4; border-radius: 16px; border-left: 4px solid #10b981;">
        <p style="margin: 0; color: #064e3b; font-size: 16px; line-height: 1.7; font-weight: 400;">
          {customGreeting}
        </p>
      </div>

      <!-- Stats Container -->
      <div class="stats-container" style="display: flex; gap: 24px; margin-bottom: 48px;">
        <!-- Stat 1 -->
        <div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #059669;"></div>
          <div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Monthly Presence</div>
          <div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{attendancePercentage}<span style="font-size: 24px; color: #059669; font-weight: 700; margin-left: 2px;">%</span></div>
        </div>
        <!-- Stat 2 -->
        <div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #34d399;"></div>
          <div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Total Punches</div>
          <div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{totalPresent}</div>
        </div>
        <!-- Stat 3 -->
        <div class="stat-card" style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); position: relative; overflow: hidden;">
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background-color: #6ee7b7;"></div>
          <div style="font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Active Staff</div>
          <div style="font-size: 40px; font-weight: 800; color: #064e3b; letter-spacing: -1px; line-height: 1;">{totalEmployees}</div>
        </div>
      </div>

      <!-- Table Section -->
      <div style="margin-bottom: 48px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;">
          <div>
            <h3 style="margin: 0 0 6px 0; color: #064e3b; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;">Detailed Attendance Grid</h3>
            <div style="font-size: 13px; color: #64748b; font-weight: 400;">Comprehensive overview of daily attendance records</div>
          </div>
          <div style="font-size: 12px; color: #047857; font-weight: 600; background: #ecfdf5; padding: 8px 14px; border-radius: 8px; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 6px;">
            <span style="font-size: 14px;">↔</span> Scroll on mobile
          </div>
        </div>
        <div style="overflow-x: auto; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          {table}
        </div>
      </div>

      <!-- Footer -->
      <div style="padding-top: 40px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; align-items: center; text-align: center;">
        <div style="margin-bottom: 20px;">
          <img src="https://app.paradigmfms.com/paradigm-logo.png" alt="Paradigm" style="height: 28px; opacity: 0.6;">
        </div>
        <p style="margin: 0 0 24px 0; color: #64748b; font-size: 13px; font-weight: 400; max-width: 500px; line-height: 1.6;">
          This is an official automated compliance report generated by the Paradigm Attendance Management System.
        </p>
        <div style="display: inline-flex; align-items: center; gap: 16px; background: #f0fdf4; padding: 12px 24px; border-radius: 100px; border: 1px solid #bbf7d0;">
          <a href="https://app.paradigmfms.com" style="color: #047857; text-decoration: none; font-weight: 700; font-size: 13px;">
            Open Dashboard &rarr;
          </a>
          <span style="color: #6ee7b7;">|</span>
          <span style="color: #064e3b; font-size: 13px; font-weight: 500;">
            &copy; {year} Paradigm Facility Management Services
          </span>
        </div>
        <div style="margin-top: 24px; font-size: 11px; color: #94a3b8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
          Generated: {generatedTime} &bull; Request By: {generatedBy}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// ▌ HRM REPORT GENERATORS
// ══════════════════════════════════════════════════════════════════════════════

async function generateHRMLeaveReport(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const todayStr = format(nowIST, 'yyyy-MM-dd');
  const generatedTime = format(nowIST, 'hh:mm a');
  const year = format(nowIST, 'yyyy');
  const { data: leaves } = await supabase
    .from('leave_applications')
    .select('id, status, leave_type, start_date, end_date, employee_id')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr);
  const all = leaves || [];
  const approved = all.filter((l: any) => l.status === 'approved');
  const pending  = all.filter((l: any) => l.status === 'pending');
  const rejected = all.filter((l: any) => l.status === 'rejected');
  const empIds = [...new Set(all.map((l: any) => l.employee_id))];
  const { data: emps } = empIds.length
    ? await supabase.from('employees').select('id, name').in('id', empIds)
    : { data: [] };
  const empMap: Record<string, string> = {};
  (emps || []).forEach((e: any) => { empMap[e.id] = e.name; });
  const badge = (s: string) => {
    const c: Record<string,string> = { approved:'background:#dcfce7;color:#15803d', pending:'background:#fef9c3;color:#a16207', rejected:'background:#fee2e2;color:#dc2626' };
    return `<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;${c[s]||'background:#f3f4f6;color:#374151'}">${s}</span>`;
  };
  const rows = all.map((l: any, i: number) =>
    `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6">${empMap[l.employee_id]||l.employee_id}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6">${l.leave_type||'—'}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #f3f4f6">${l.start_date}→${l.end_date}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #f3f4f6">${badge(l.status)}</td>
    </tr>`).join('');
  return {
    date: format(nowIST, 'EEEE, MMMM do, yyyy'),
    totalOnLeave: String(all.length),
    approvedCount: String(approved.length),
    pendingCount: String(pending.length),
    rejectedCount: String(rejected.length),
    table: rows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#6b7280">No leaves today</td></tr>',
    generatedTime, year,
  };
}

async function generateHRMNewJoinersReport(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const todayStr  = format(nowIST, 'yyyy-MM-dd');
  const weekStartDate = new Date(nowIST.getTime() - 6 * 24 * 60 * 60 * 1000);
  const weekStart = format(weekStartDate, 'yyyy-MM-dd');
  const year = format(nowIST, 'yyyy');
  const generatedTime = format(nowIST, 'hh:mm a');
  const { data: joiners } = await supabase
    .from('employees')
    .select('id, name, role, department, location, date_of_joining')
    .gte('date_of_joining', weekStart)
    .lte('date_of_joining', todayStr)
    .order('date_of_joining', { ascending: false });
  const all = joiners || [];
  const rows = all.map((e: any, i: number) =>
    `<tr style="background:${i%2===0?'#fff':'#f9fafb'}">
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;font-weight:600">${e.name||'—'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6">${e.role||e.department||'—'}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #f3f4f6">${e.location||'—'}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #f3f4f6">${e.date_of_joining||'—'}</td>
    </tr>`).join('');
  const depts = new Set(all.map((e: any) => e.department).filter(Boolean));
  const locs  = new Set(all.map((e: any) => e.location).filter(Boolean));
  return {
    weekStart: format(weekStartDate, 'MMM do, yyyy'),
    totalJoiners: String(all.length),
    departmentCount: String(depts.size),
    locationCount: String(locs.size),
    table: rows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#6b7280">No new joiners this week</td></tr>',
    generatedTime, year,
  };
}

async function generateHRMPendingApprovalsReport(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const year = format(nowIST, 'yyyy');
  const generatedTime = format(nowIST, 'hh:mm a');
  const { data: pLeaves } = await supabase
    .from('leave_applications')
    .select('id, leave_type, applied_on, employee_id')
    .eq('status', 'pending')
    .order('applied_on', { ascending: true });
  const leaves = pLeaves || [];
  const empIds = [...new Set(leaves.map((l: any) => l.employee_id))];
  const { data: emps } = empIds.length
    ? await supabase.from('employees').select('id, name').in('id', empIds)
    : { data: [] };
  const empMap: Record<string, string> = {};
  (emps || []).forEach((e: any) => { empMap[e.id] = e.name; });
  const rows = leaves.slice(0, 20).map((l: any, i: number) => {
    const days = l.applied_on ? Math.ceil((nowIST.getTime() - new Date(l.applied_on).getTime()) / 86400000) : '—';
    return `<tr style="background:${i%2===0?'#fff':'#fffbeb'}">
      <td style="padding:10px 14px;border-bottom:1px solid #fef3c7;font-weight:600">${empMap[l.employee_id]||l.employee_id}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #fef3c7">Leave — ${l.leave_type||'General'}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #fef3c7">${(l.applied_on||'').split('T')[0]}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #fef3c7;font-weight:700;color:#d97706">${days}</td>
    </tr>`;
  }).join('');
  return {
    date: format(nowIST, 'EEEE, MMMM do, yyyy'),
    pendingLeaves: String(leaves.length),
    pendingOT: '0',
    pendingCompOff: '0',
    totalPending: String(leaves.length),
    table: rows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#6b7280">No pending approvals</td></tr>',
    generatedTime, year,
  };
}

async function generateHRMPayrollSnapshot(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const month = format(nowIST, 'MMMM');
  const year  = format(nowIST, 'yyyy');
  const generatedTime = format(nowIST, 'hh:mm a');
  const monthStart = format(nowIST, 'yyyy-MM-01');
  const monthEnd   = format(nowIST, 'yyyy-MM-dd');
  const { data: empsData } = await supabase.from('employees').select('id, name, department, basic_salary').eq('status', 'active');
  const emps = empsData || [];
  const totalPayroll = emps.reduce((s: number, e: any) => s + (Number(e.basic_salary) || 0), 0);
  const { data: attRecs } = await supabase.from('attendance_records').select('employee_id, status').gte('date', monthStart).lte('date', monthEnd);
  const recs = attRecs || [];
  const present = recs.filter((r: any) => r.status === 'present' || r.status === 'P');
  const pct = recs.length > 0 ? Math.round((present.length / recs.length) * 100) : 0;
  const { data: joiners } = await supabase.from('employees').select('id').gte('date_of_joining', monthStart).lte('date_of_joining', monthEnd);
  const deptMap: Record<string, { count: number; present: number; total: number }> = {};
  emps.forEach((e: any) => { const d = e.department||'Unassigned'; if (!deptMap[d]) deptMap[d]={count:0,present:0,total:0}; deptMap[d].count++; });
  recs.forEach((r: any) => {
    const emp = emps.find((e: any) => e.id === r.employee_id);
    if (!emp) return;
    const d = emp.department||'Unassigned';
    if (!deptMap[d]) deptMap[d]={count:0,present:0,total:0};
    deptMap[d].total++;
    if (r.status==='present'||r.status==='P') deptMap[d].present++;
  });
  const rows = Object.entries(deptMap).map(([dept, data], i) => {
    const dp = (data as any).total > 0 ? Math.round(((data as any).present / (data as any).total) * 100) : 0;
    return `<tr style="background:${i%2===0?'#fff':'#f0fdfa'}">
      <td style="padding:10px 14px;border-bottom:1px solid #ccfbf1;font-weight:600">${dept}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #ccfbf1">${(data as any).count}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #ccfbf1;font-weight:700;color:#0f766e">${dp}%</td>
    </tr>`;
  }).join('');
  return {
    month, year,
    headcount: String(emps.length),
    totalPayroll: totalPayroll.toLocaleString('en-IN'),
    avgAttendance: String(pct),
    newJoiners: String((joiners||[]).length),
    table: rows || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#6b7280">No department data</td></tr>',
    generatedTime,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ▌ CRM REPORT GENERATORS
// ══════════════════════════════════════════════════════════════════════════════

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDailyTravelKm(events: any[]): number {
  if (!events || events.length === 0) return 0;
  let savedDistance = 0;
  let hasNonZeroSavedDistance = false;
  events.forEach(e => {
    if (e.travel_distance !== undefined && e.travel_distance !== null && e.travel_distance > 0) {
      savedDistance += e.travel_distance;
      hasNonZeroSavedDistance = true;
    }
  });
  if (hasNonZeroSavedDistance) {
    return Number(savedDistance.toFixed(2));
  }
  const sorted = [...events]
      .filter(e => e.type === 'punch-in' || e.type === 'punch-out' || e.type === 'site-in' || e.type === 'site-out')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  let totalDist = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current.latitude && current.longitude && next.latitude && next.longitude) {
          const dist = calculateDistanceMeters(
              Number(current.latitude), Number(current.longitude),
              Number(next.latitude), Number(next.longitude)
          ) / 1000;
          totalDist += dist;
      }
  }
  return Number(totalDist.toFixed(2));
}

async function generateCRMBdDailyReport(supabase: ReturnType<typeof createClient>, nowIST: Date): Promise<Record<string, string>[]> {
  const todayStr = getISTDateString(nowIST);
  const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - IST_OFFSET));

  const { data: usersRes } = await supabase.from('users').select('id, name, role:roles(display_name)').eq('is_blocked', false);
  const bdUsers = ((usersRes || []) as User[]).filter((u: User) => {
    const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
    return roleName.toLowerCase() === 'business developer' || roleName.toLowerCase() === 'business_developer';
  });

  if (bdUsers.length === 0) {
    return [{
      bd_name: 'All BDs',
      bdName: 'All BDs',
      report_date: format(nowIST, 'dd MMM yyyy'),
      reportDate: format(nowIST, 'dd MMM yyyy'),
      attendance_status: 'No Active BDs',
      attendanceStatus: 'No Active BDs',
      check_in_time: 'N/A',
      checkInTime: 'N/A',
      check_out_time: 'N/A',
      checkOutTime: 'N/A',
      working_hours: '0h 0m',
      workingHours: '0h 0m',
      kms_travelled: '0',
      kmsTravelled: '0',
      prospect_calls: '0',
      prospectCalls: '0',
      followup_calls: '0',
      followupCalls: '0',
      new_leads_count: '0',
      newLeadsCount: '0',
      sites_count: '0',
      sitesCount: '0',
      sites_visited: 'None',
      sitesVisited: 'None',
      new_leads_table: '<div style="padding:16px;text-align:center;color:#64748b;">No active Business Developers found.</div>',
      newLeadsTable: '<div style="padding:16px;text-align:center;color:#64748b;">No active Business Developers found.</div>',
      metrics_table: '',
      metricsTable: '',
      pipeline_snapshot: '',
      pipelineSnapshot: ''
    }];
  }

  const [eventsRes, leadsRes, callsRes] = await Promise.all([
    supabase.from('attendance_events').select('user_id, type, timestamp, latitude, longitude, travel_distance').gte('timestamp', startOfTodayUTC.toISOString()).order('timestamp', { ascending: true }),
    supabase.from('crm_leads').select('id, created_by, assigned_to, company_name, contact_person, status, created_at').gte('created_at', startOfTodayUTC.toISOString()),
    supabase.from('crm_followups').select('created_by, type, lead_id, created_at').gte('created_at', startOfTodayUTC.toISOString())
  ]);

  const events = eventsRes.data || [];
  const leads = leadsRes.data || [];
  const calls = callsRes.data || [];

  const { data: allActiveLeads } = await supabase.from('crm_leads')
    .select('assigned_to, created_by, status')
    .neq('status', 'Won')
    .neq('status', 'Lost');

  const reports: Record<string, string>[] = [];

  for (const bd of bdUsers) {
    const bdEvents = [...events.filter((e: any) => e.user_id === bd.id)].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let attendance_status = bdEvents.length > 0 ? 'Present' : 'Absent';
    let check_in_time = 'N/A';
    let check_out_time = 'N/A';
    let working_hours = '0h 0m';
    
    const punchesIn = bdEvents.filter((e: any) => e.type === 'punch-in' || e.type === 'site-in' || e.type === 'site-ot-in');
    const punchesOut = bdEvents.filter((e: any) => e.type === 'punch-out' || e.type === 'site-out' || e.type === 'site-ot-out');
    
    if (punchesIn.length > 0) {
      check_in_time = format(new Date(new Date(punchesIn[0].timestamp).getTime() + IST_OFFSET), 'hh:mm a');
    }
    if (punchesOut.length > 0) {
      check_out_time = format(new Date(new Date(punchesOut[punchesOut.length - 1].timestamp).getTime() + IST_OFFSET), 'hh:mm a');
    }
  
    let netWorkMinutes = 0;
    let isOnBreak = false;
    let lastTime: Date | null = null;
    let isPunchedIn = false;

    bdEvents.forEach((e: any) => {
      const evTime = new Date(e.timestamp);
      if (lastTime) {
        const elapsed = (evTime.getTime() - lastTime.getTime()) / 60000;
        if (isPunchedIn && !isOnBreak && elapsed > 0 && elapsed < 30 * 60) {
          netWorkMinutes += elapsed;
        }
      }
      
      if (e.type === 'punch-in' || e.type === 'site-in' || e.type === 'site-ot-in') {
        isPunchedIn = true;
      } else if (e.type === 'punch-out' || e.type === 'site-out' || e.type === 'site-ot-out') {
        isPunchedIn = false;
        isOnBreak = false;
      } else if (e.type === 'break-in') {
        isOnBreak = true;
      } else if (e.type === 'break-out') {
        isOnBreak = false;
      }
      lastTime = evTime;
    });

    if (netWorkMinutes > 0) {
      const hrs = Math.floor(netWorkMinutes / 60);
      const mins = Math.floor(netWorkMinutes % 60);
      working_hours = `${hrs}h ${mins}m`;
    }

    const newLeadsToday = leads.filter((l: any) => l.created_by === bd.id || l.assigned_to === bd.id);
    const newLeadsIds = new Set(newLeadsToday.map((l: any) => l.id));
    
    const prospect_calls = calls.filter((c: any) => c.created_by === bd.id && c.type === 'Call' && newLeadsIds.has(c.lead_id)).length;
    const followup_calls = calls.filter((c: any) => c.created_by === bd.id && c.type === 'Call' && !newLeadsIds.has(c.lead_id)).length;
    
    const new_leads_count = newLeadsToday.length;
    const sites_count = calls.filter((c: any) => c.created_by === bd.id && c.type === 'Site Visit').length;
    const sites_visited = 'Not applicable (Automated Schedule)';
    let kms_travelled = calculateDailyTravelKm(bdEvents).toString();

    let new_leads_table = `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No new leads added today.</div>`;
    if (newLeadsToday.length > 0) {
      new_leads_table = `<table width="100%" style="border-collapse:collapse;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Company</th>
          <th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Contact</th>
          <th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</th>
        </tr></thead><tbody>`;
      newLeadsToday.forEach((lead: any, i: number) => {
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        new_leads_table += `<tr style="background:${bg};">
          <td style="padding:12px 14px;font-size:12px;color:#1e293b;font-weight:600;border-top:1px solid #f1f5f9;">${lead.company_name}</td>
          <td style="padding:12px 14px;font-size:12px;color:#475569;border-top:1px solid #f1f5f9;">${lead.contact_person || '-'}</td>
          <td style="padding:12px 14px;text-align:center;border-top:1px solid #f1f5f9;">
            <span style="background:#e0e7ff;color:#4338ca;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;">${lead.status}</span>
          </td>
        </tr>`;
      });
      new_leads_table += `</tbody></table>`;
    }

    let metrics_table = `<table width="100%" style="border-collapse:collapse;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Metric</th>
        <th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Target</th>
        <th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Actual</th>
        <th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Remarks</th>
      </tr></thead><tbody>`;
    
    const metricsData = [
      { metric: 'Outbound Calls (New Prospects)', target: '-', actual: prospect_calls, remarks: '' },
      { metric: 'Follow-up Calls / Emails', target: '-', actual: followup_calls, remarks: '' },
      { metric: 'Site Visits Conducted', target: '-', actual: sites_count, remarks: 'Automated' },
      { metric: 'Proposals Submitted', target: '-', actual: 0, remarks: 'Automated' },
      { metric: 'New Leads Added', target: '-', actual: new_leads_count, remarks: '' }
    ];

    metricsData.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      metrics_table += `<tr style="background:${bg};">
        <td style="padding:12px 14px;font-size:12px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;">${row.metric}</td>
        <td style="padding:12px 14px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #f1f5f9;">${row.target}</td>
        <td style="padding:12px 14px;text-align:center;font-size:12px;font-weight:600;color:#0f172a;border-top:1px solid #f1f5f9;">${row.actual}</td>
        <td style="padding:12px 14px;font-size:11px;color:#64748b;font-style:italic;border-top:1px solid #f1f5f9;">${row.remarks || '-'}</td>
      </tr>`;
    });
    metrics_table += `</tbody></table>`;

    const myActiveLeads = (allActiveLeads || []).filter((l: any) => l.assigned_to === bd.id || l.created_by === bd.id);
    const statuses = ['New Lead', 'Contacted', 'Site Visit Planned', 'Survey Completed', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
    let pipeline_snapshot = `<table width="100%" style="border-collapse:collapse;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Stage</th>
        <th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Count</th>
      </tr></thead><tbody>`;
    
    let activeTotal = 0;
    statuses.forEach((stage, i) => {
      const count = myActiveLeads.filter((l: any) => l.status === stage).length;
      activeTotal += count;
      const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      pipeline_snapshot += `<tr style="background:${bg};">
        <td style="padding:12px 14px;font-size:12px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;">${stage}</td>
        <td style="padding:12px 14px;text-align:center;font-size:12px;font-weight:700;color:#3b82f6;border-top:1px solid #f1f5f9;">${count}</td>
      </tr>`;
    });
    pipeline_snapshot += `</tbody></table>
    <div style="margin-top:8px;text-align:right;font-size:11px;color:#94a3b8;padding:8px;">Total active pipeline: ${activeTotal} leads</div>`;

    reports.push({
      date: format(nowIST, 'dd MMM yyyy'),
      bd_name: bd.name || 'BD',
      bdName: bd.name || 'BD',
      report_date: format(nowIST, 'dd MMM yyyy'),
      reportDate: format(nowIST, 'dd MMM yyyy'),
      attendance_status,
      attendanceStatus: attendance_status,
      check_in_time,
      checkInTime: check_in_time,
      check_out_time,
      checkOutTime: check_out_time,
      working_hours,
      workingHours: working_hours,
      kms_travelled,
      kmsTravelled: kms_travelled,
      prospect_calls: String(prospect_calls),
      prospectCalls: String(prospect_calls),
      followup_calls: String(followup_calls),
      followupCalls: String(followup_calls),
      new_leads_count: String(new_leads_count),
      newLeadsCount: String(new_leads_count),
      sites_count: String(sites_count),
      sitesCount: String(sites_count),
      sites_visited,
      sitesVisited: sites_visited,
      new_leads_table,
      newLeadsTable: new_leads_table,
      metrics_table,
      metricsTable: metrics_table,
      pipeline_snapshot,
      pipelineSnapshot: pipeline_snapshot
    });
  }

  return reports;
}

async function generateCRMDailyPipelineReport(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const todayStr = format(nowIST, 'yyyy-MM-dd');
  const year = format(nowIST, 'yyyy');
  const generatedTime = format(nowIST, 'hh:mm a');
  const { data: leads } = await supabase.from('crm_leads').select('id, stage, status, created_at, updated_at');
  const all = leads || [];
  const todayStart = todayStr + 'T00:00:00';
  const todayEnd   = todayStr + 'T23:59:59';
  const wonToday  = all.filter((l: any) => l.status==='won'  && l.updated_at>=todayStart && l.updated_at<=todayEnd);
  const lostToday = all.filter((l: any) => l.status==='lost' && l.updated_at>=todayStart && l.updated_at<=todayEnd);
  const newToday  = all.filter((l: any) => l.created_at>=todayStart && l.created_at<=todayEnd);
  const won = all.filter((l: any) => l.status==='won');
  const convRate = all.length > 0 ? Math.round((won.length/all.length)*100) : 0;
  const stageMap: Record<string, number> = {};
  all.forEach((l: any) => { const s=l.stage||'Unknown'; stageMap[s]=(stageMap[s]||0)+1; });
  const rows = Object.entries(stageMap).sort((a,b)=>b[1]-a[1]).map(([stage, count], i) => {
    const pct = all.length > 0 ? Math.round((count/all.length)*100) : 0;
    return `<tr style="background:${i%2===0?'#fff':'#eff6ff'}">
      <td style="padding:10px 14px;border-bottom:1px solid #dbeafe;font-weight:600">${stage}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #dbeafe">${count}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #dbeafe;font-weight:700;color:#2563eb">${pct}%</td>
    </tr>`;
  }).join('');
  return {
    date: format(nowIST, 'EEEE, MMMM do, yyyy'),
    totalLeads: String(all.length),
    wonToday: String(wonToday.length),
    lostToday: String(lostToday.length),
    newToday: String(newToday.length),
    conversionRate: String(convRate),
    table: rows || '<tr><td colspan="3" style="padding:20px;text-align:center;color:#6b7280">No pipeline data</td></tr>',
    generatedTime, year,
  };
}

async function generateCRMWeeklySalesReport(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const weekStartDate = new Date(nowIST.getTime() - 6 * 24 * 60 * 60 * 1000);
  const weekStart = format(weekStartDate, 'yyyy-MM-dd');
  const weekRange = `${format(weekStartDate, 'MMM d')} – ${format(nowIST, 'MMM d, yyyy')}`;
  const year = format(nowIST, 'yyyy');
  const generatedTime = format(nowIST, 'hh:mm a');
  const { data: leads } = await supabase.from('crm_leads').select('id, stage, status, assigned_to, created_at, updated_at').gte('created_at', weekStart + 'T00:00:00');
  const weekLeads = leads || [];
  const won  = weekLeads.filter((l: any) => l.status==='won');
  const lost = weekLeads.filter((l: any) => l.status==='lost');
  const { data: movers } = await supabase.from('crm_leads').select('id, assigned_to').gte('updated_at', weekStart+'T00:00:00').lt('created_at', weekStart+'T00:00:00');
  const agentMap: Record<string, { handled: number; won: number }> = {};
  weekLeads.forEach((l: any) => {
    const a = l.assigned_to||'Unassigned';
    if (!agentMap[a]) agentMap[a]={handled:0,won:0};
    agentMap[a].handled++;
    if (l.status==='won') agentMap[a].won++;
  });
  const sorted = Object.entries(agentMap).sort((a,b)=>b[1].won-a[1].won);
  const topAgent = sorted[0]?.[0]||'—';
  const topWon   = sorted[0]?.[1].won||0;
  const rows = sorted.map(([agent, data], i) => {
    const pct = data.handled > 0 ? Math.round((data.won/data.handled)*100) : 0;
    return `<tr style="background:${i%2===0?'#fff':'#f0fdf4'}">
      <td style="padding:10px 14px;border-bottom:1px solid #bbf7d0;font-weight:600">${agent}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #bbf7d0">${data.handled}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #bbf7d0;font-weight:700;color:#15803d">${data.won}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #bbf7d0">${pct}%</td>
    </tr>`;
  }).join('');
  const badge = topAgent !== '—'
    ? `<div style="margin-top:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 18px;">
        <span style="font-size:22px">&#127942;</span>
        <strong style="color:#15803d"> Top: ${topAgent} — ${topWon} deals won</strong></div>`
    : '';
  return {
    weekRange,
    leadsCreated: String(weekLeads.length),
    stageMovements: String((movers||[]).length),
    wonThisWeek: String(won.length),
    lostThisWeek: String(lost.length),
    table: rows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#6b7280">No sales data this week</td></tr>',
    topPerformerBadge: badge,
    generatedTime, year,
  };
}

async function generateCRMLeadAgingReport(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const cutoff = format(new Date(nowIST.getTime() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm:ss");
  const year = format(nowIST, 'yyyy');
  const generatedTime = format(nowIST, 'hh:mm a');
  const { data: stale } = await supabase
    .from('crm_leads')
    .select('id, client_name, stage, assigned_to, city, updated_at, created_at')
    .neq('status', 'won').neq('status', 'lost')
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true });
  const leads = stale || [];
  const daysStale = (l: any) => Math.ceil((nowIST.getTime() - new Date(l.updated_at||l.created_at).getTime()) / 86400000);
  const avg = leads.length > 0 ? Math.round(leads.reduce((s: number, l: any) => s + daysStale(l), 0) / leads.length) : 0;
  const oldest = leads.length > 0 ? daysStale(leads[0]) : 0;
  const rows = leads.slice(0, 25).map((l: any, i: number) => {
    const days = daysStale(l);
    return `<tr style="background:${days>60?'#fef2f2':i%2===0?'#fff':'#fff5f5'}">
      <td style="padding:10px 14px;border-bottom:1px solid #fecaca;font-weight:600">${l.client_name||'—'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #fecaca">${l.stage||'—'}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #fecaca">${l.assigned_to||'—'}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #fecaca">${l.city||'—'}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #fecaca;font-weight:800;color:${days>60?'#dc2626':'#d97706'}">${days}</td>
    </tr>`;
  }).join('');
  return {
    date: format(nowIST, 'EEEE, MMMM do, yyyy'),
    totalStale: String(leads.length),
    avgDaysInStage: String(avg),
    oldestLeadDays: String(oldest),
    table: rows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#6b7280">No stale leads — great work!</td></tr>',
    generatedTime, year,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ▌ OPS REPORT GENERATORS
// ══════════════════════════════════════════════════════════════════════════════

async function generateOpsTaskSummary(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const todayStr = format(nowIST, 'yyyy-MM-dd');
  const year = format(nowIST, 'yyyy');
  const generatedTime = format(nowIST, 'hh:mm a');
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, assigned_to, priority, due_date, status')
    .order('due_date', { ascending: true })
    .limit(100);
  const all = tasks || [];
  const completed  = all.filter((t: any) => t.status==='completed'||t.status==='done');
  const inProgress = all.filter((t: any) => t.status==='in_progress'||t.status==='in-progress');
  const overdue    = all.filter((t: any) => t.due_date && t.due_date < todayStr && t.status!=='completed' && t.status!=='done');
  const badge = (p: string) => {
    const c: Record<string,string> = { high:'background:#fee2e2;color:#dc2626', medium:'background:#fef9c3;color:#a16207', low:'background:#dcfce7;color:#15803d' };
    return `<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;${c[(p||'').toLowerCase()]||'background:#f3f4f6;color:#374151'}">${p||'—'}</span>`;
  };
  const urgent = [...overdue, ...all.filter((t: any) => (t.priority||'').toLowerCase()==='high' && !overdue.find((o: any)=>o.id===t.id))].slice(0, 15);
  const rows = urgent.map((t: any, i: number) => {
    const isOverdue = overdue.find((o: any) => o.id === t.id);
    return `<tr style="background:${isOverdue?'#fff5f5':i%2===0?'#fff':'#f0f9ff'}">
      <td style="padding:10px 14px;border-bottom:1px solid #e0f2fe;font-weight:600">${t.title||'—'}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e0f2fe">${t.assigned_to||'—'}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e0f2fe">${badge(t.priority)}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #e0f2fe">${t.due_date||'—'}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #e0f2fe;font-weight:700;color:${isOverdue?'#dc2626':t.status==='completed'?'#15803d':'#d97706'}">${t.status||'—'}</td>
    </tr>`;
  }).join('');
  return {
    date: format(nowIST, 'EEEE, MMMM do, yyyy'),
    totalTasks: String(all.length),
    completedTasks: String(completed.length),
    inProgressTasks: String(inProgress.length),
    overdueTasks: String(overdue.length),
    table: rows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#6b7280">No urgent tasks</td></tr>',
    generatedTime, year,
  };
}

async function generateOpsSiteActivityReport(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const todayStr = format(nowIST, 'yyyy-MM-dd');
  const year = format(nowIST, 'yyyy');
  const generatedTime = format(nowIST, 'hh:mm a');
  const { data: recs } = await supabase
    .from('attendance_records')
    .select('employee_id, location, status, check_in_time, date')
    .eq('date', todayStr);
  const todayRecs = recs || [];
  const siteMap: Record<string, { staff: Set<string>; pings: number; last: string }> = {};
  todayRecs.forEach((r: any) => {
    const s = r.location||'Main Office';
    if (!siteMap[s]) siteMap[s]={staff:new Set(),pings:0,last:'—'};
    siteMap[s].staff.add(r.employee_id);
    siteMap[s].pings++;
    if (r.check_in_time && (siteMap[s].last==='—' || r.check_in_time > siteMap[s].last)) siteMap[s].last = r.check_in_time;
  });
  const { data: allEmps } = await supabase.from('employees').select('location').eq('status', 'active');
  const allLocs = new Set((allEmps||[]).map((e: any) => e.location).filter(Boolean));
  const inactive = [...allLocs].filter(l => !siteMap[l]).length;
  const rows = Object.entries(siteMap).sort((a,b)=>b[1].pings-a[1].pings).map(([site, data], i) => {
    const last = data.last !== '—' ? (data.last.split('T')[1]||data.last).substring(0,5) : '—';
    return `<tr style="background:${i%2===0?'#fff':'#f0fdf4'}">
      <td style="padding:10px 14px;border-bottom:1px solid #bbf7d0;font-weight:600">${site}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #bbf7d0">${data.staff.size}</td>
      <td style="padding:10px 14px;text-align:center;border-bottom:1px solid #bbf7d0;font-weight:700;color:#15803d">${data.pings}</td>
      <td style="padding:10px 14px;text-align:right;border-bottom:1px solid #bbf7d0">${last}</td>
    </tr>`;
  }).join('');
  return {
    date: format(nowIST, 'EEEE, MMMM do, yyyy'),
    activeSites: String(Object.keys(siteMap).length),
    totalPings: String(todayRecs.length),
    fieldStaffActive: String(new Set(todayRecs.map((r: any) => r.employee_id)).size),
    inactiveSites: String(inactive),
    table: rows || '<tr><td colspan="4" style="padding:20px;text-align:center;color:#6b7280">No site activity today</td></tr>',
    generatedTime, year,
  };
}
