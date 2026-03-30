// @ts-nocheck — This file runs in Deno (Supabase Edge Functions), not Node.js.
// The TypeScript IDE may not resolve Deno imports; runtime types are correct.
// deno-lint-ignore-file

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format, startOfDay, isSameDay } from "https://esm.sh/date-fns@2.30.0";
import { SmtpClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

interface EmailConfig {
  user: string;
  pass: string;
  enabled: boolean;
  host?: string;
  port?: number | string;
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { ruleId, force } = body;

    console.log(`[process-email-schedules] Triggered. ruleId=${ruleId}, force=${force}`);

    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('email_config')
      .eq('id', 'singleton')
      .single();

    if (settingsError) throw settingsError;
    const emailConfig = settings?.email_config as EmailConfig;

    if (!emailConfig?.user || !emailConfig?.pass || !emailConfig?.enabled) {
      return new Response(JSON.stringify({ message: 'Email not configured or disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let query = supabase.from('email_schedule_rules').select('*').eq('is_active', true);
    if (ruleId) query = query.eq('id', ruleId);
    const { data: rules, error: rulesErr } = await query;
    const typedRules = (rules || []) as EmailScheduleRule[];
    if (rulesErr) throw rulesErr;
    if (!typedRules || typedRules.length === 0) {
      return new Response(JSON.stringify({ message: 'No active schedules' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: templates } = await supabase.from('email_templates').select('*');
    const typedTemplates = (templates || []) as EmailTemplate[];
    const templateMap = new Map<string, EmailTemplate>(typedTemplates.map(t => [t.id, t]));

    const now = new Date();
    const nowIST = new Date(now.getTime() + IST_OFFSET);
    let totalSent = 0;

    for (const rule of typedRules) {
      const isForceRun = force || ruleId === rule.id;

      if (rule.trigger_type === 'scheduled' && !isForceRun) {
        const { shouldRun, reason } = shouldRunScheduleWithStatus(rule, nowIST);
        if (!shouldRun) {
          console.log(`  → Skipped "${rule.name}": ${reason}`);
          continue;
        }

        if (rule.last_sent_at) {
          const lastSentDate = new Date(rule.last_sent_at);
          const lastSentIST = new Date(lastSentDate.getTime() + IST_OFFSET);
          if (isSameDay(lastSentIST, nowIST)) {
            console.log(`  → Skipped "${rule.name}" (Already sent for today: ${rule.last_sent_at})`);
            continue;
          }
        }
      }

      let reportData: Record<string, string> = { date: format(nowIST, 'EEEE, MMMM do, yyyy') };
      if (rule.report_type === 'attendance_daily') reportData = await generateDailyAttendanceReport(supabase, nowIST);
      else if (rule.report_type === 'attendance_monthly') reportData = { date: format(nowIST, 'yyyy-MM') };
      else if (rule.report_type === 'document_expiry') reportData = { date: format(nowIST, 'yyyy-MM-dd') };
      else if (rule.report_type === 'pending_approvals') reportData = { items: '0' };

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

      const emails = await resolveRecipients(supabase, rule);
      if (emails.length === 0) continue;

      try {
        const client = new SmtpClient();
        await client.connect({
          hostname: emailConfig.host || 'smtp.gmail.com',
          port: Number(emailConfig.port) || 587,
          username: emailConfig.user,
          password: emailConfig.pass,
        });

        await client.send({
          from: `"${emailConfig.from_name || 'Paradigm FMS'}" <${emailConfig.from_email || emailConfig.user}>`,
          to: emails,
          subject: subject,
          content: html,
          html: html,
        });

        await client.close();

        await Promise.all([
          ...emails.map(email => supabase.from('email_logs').insert({ rule_id: rule.id, template_id: rule.template_id, recipient_email: email, subject, status: 'sent' })),
          supabase.from('email_schedule_rules').update({ last_sent_at: now.toISOString() }).eq('id', rule.id)
        ]);
        totalSent += emails.length;
        console.log(`[process-email-schedules] Sent report "${rule.name}" to ${emails.length} recipients`);
      } catch (mailErr) {
        const errorMsg = mailErr instanceof Error ? mailErr.message : String(mailErr);
        console.error(`  → Mail failed for "${rule.name}":`, errorMsg);
        await Promise.all(emails.map(email => supabase.from('email_logs').insert({ rule_id: rule.id, template_id: rule.template_id, recipient_email: email, subject, status: 'failed', error_message: errorMsg })));
      }
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[CRITICAL ERROR]`, errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function shouldRunScheduleWithStatus(rule: EmailScheduleRule, nowIST: Date): { shouldRun: boolean; reason: string } {
  const config = rule.schedule_config || {};
  const [hour, minute] = (config.time || '21:00').split(':').map(Number);
  const currentHour = nowIST.getUTCHours();
  const currentMinute = nowIST.getUTCMinutes();
  
  if (currentHour < hour || (currentHour === hour && currentMinute < minute)) {
    return { shouldRun: false, reason: `Time ${config.time} not reached (IST: ${currentHour}:${currentMinute})` };
  }

  const freq = config.frequency || 'daily';
  if (freq === 'weekly' && config.dayOfWeek !== undefined && config.dayOfWeek !== nowIST.getUTCDay()) return { shouldRun: false, reason: 'Wrong day' };
  if (freq === 'monthly' && config.dayOfMonth !== undefined && config.dayOfMonth !== nowIST.getUTCDate()) return { shouldRun: false, reason: 'Wrong month day' };

  return { shouldRun: true, reason: 'Scheduled time reached' };
}

async function resolveRecipients(supabase: ReturnType<typeof createClient>, rule: EmailScheduleRule): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []).eq('is_active', true);
    return (users || []).map((u: { email: string }) => u.email).filter(Boolean);
  }
  return (rule.recipient_type === 'users') ? (await supabase.from('users').select('email').in('id', rule.recipient_user_ids || [])).data?.map((u: { email: string }) => u.email).filter(Boolean) || [] : [];
}

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

function evaluateConditionals(str: string, data: Record<string, string>) {
  return str.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (_m, key, op, val2Str, t, f) => {
    const v1 = parseFloat(data[Object.keys(data).find(k=>k.toLowerCase()===key.toLowerCase())||''] || '0');
    const v2 = parseFloat(val2Str);
    let ok = false;
    if(op==='>')ok=v1>v2; else if(op==='<')ok=v1<v2; else if(op==='>=')ok=v1>=v2; else if(op==='<=')ok=v1<=v2; else if(op==='==')ok=v1==v2; else if(op==='!=')ok=v1!=v2;
    return ok ? t : f;
  });
}

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
