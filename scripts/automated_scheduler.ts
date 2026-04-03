/**
 * AUTOMATED EMAIL SCHEDULER (GitHub Actions Version)
 * This script runs every 10 minutes on GitHub Actions.
 * It connects directly to Supabase, generates reports, and sends emails via SMTP.
 * Bypasses all Vercel WAF (429) and Deno Port restrictions.
 */

import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import { format, startOfDay } from 'date-fns';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration from Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

async function run() {
  console.log(`[Scheduler] Starting... ${new Date().toISOString()}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Error] Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch Email Config
  const { data: settings } = await supabase.from('settings').select('email_config').eq('id', 'singleton').single();
  const emailConfig = settings?.email_config;

  if (!emailConfig?.enabled) {
    console.log('[Info] Email automation is disabled in settings');
    return;
  }

  // 2. Fetch Active Rules
  const { data: rules, error: rulesErr } = await supabase
    .from('email_schedule_rules')
    .select('*')
    .eq('is_active', true);

  if (rulesErr) throw rulesErr;
  if (!rules || rules.length === 0) {
    console.log('[Info] No active email schedule rules found');
    return;
  }

  console.log(`[Info] Processing ${rules.length} active rule(s)...`);

  // 3. Setup SMTP Transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const fromName = emailConfig.from_name || 'Paradigm FMS';
  const fromEmail = emailConfig.from_email || SMTP_USER;
  const replyTo = emailConfig.reply_to || fromEmail;

  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  const istDateStr = nowIST.toISOString().substring(0, 10);
  const istTimeStr = `${String(nowIST.getUTCHours()).padStart(2, '0')}:${String(nowIST.getUTCMinutes()).padStart(2, '0')}`;

  console.log(`[Time] Current IST: ${istDateStr} ${istTimeStr}`);

  // 4. Load Templates
  const { data: templates } = await supabase.from('email_templates').select('*');
  const templateMap = new Map((templates || []).map(t => [t.id, t]));

  for (const rule of rules) {
    console.log(`\n[Rule] "${rule.name}" (${rule.report_type})`);
    
    // Trigger Check
    if (rule.trigger_type === 'scheduled') {
      const config = rule.schedule_config || {};
      const targetTime = config.time || '09:00';
      
      // Time check (Total minutes for precision)
      const [tHour, tMin] = targetTime.split(':').map(Number);
      const currentTotalMin = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();
      const targetTotalMin = tHour * 60 + tMin;

      if (currentTotalMin < targetTotalMin) {
        console.log(`  → Skipped: Target time ${targetTime} IST not reached`);
        continue;
      }

      // Frequency Check
      const freq = config.frequency || 'daily';
      if (freq === 'weekly' && config.dayOfWeek !== undefined && config.dayOfWeek !== nowIST.getUTCDay()) {
        console.log(`  → Skipped: Wrong day of week (Target: ${config.dayOfWeek})`);
        continue;
      }
      if (freq === 'monthly' && config.dayOfMonth !== undefined && config.dayOfMonth !== nowIST.getUTCDate()) {
        console.log(`  → Skipped: Wrong day of month (Target: ${config.dayOfMonth})`);
        continue;
      }

      // Already Sent Check
      if (rule.last_sent_at) {
        const lastSentIST = new Date(new Date(rule.last_sent_at).getTime() + IST_OFFSET);
        const lastSentDateStr = lastSentIST.toISOString().substring(0, 10);
        if (lastSentDateStr === istDateStr) {
          console.log(`  → Skipped: Already sent today (${lastSentDateStr})`);
          continue;
        }
      }
    }

    // Generate Report
    console.log(`  → Executing: Generating ${rule.report_type} report...`);
    let reportData: Record<string, string> = { date: format(nowIST, 'EEEE, MMMM do, yyyy') };
    
    try {
      if (rule.report_type === 'attendance_daily') {
        reportData = await generateDailyAttendanceReport(supabase, nowIST);
      } else if (rule.report_type === 'attendance_monthly') {
        reportData = { date: format(nowIST, 'yyyy-MM'), items: '0' };
      } else if (rule.report_type === 'document_expiry') {
        reportData = { date: istDateStr, items: '0' };
      } else if (rule.report_type === 'pending_approvals') {
        reportData = { date: istDateStr, items: '0' };
      }
    } catch (err: any) {
      console.error(`  [!] Report generation failed:`, err.message);
      continue;
    }

    // Render Template
    const template = templateMap.get(rule.template_id);
    let subject = template?.subject_template || rule.name;
    let html = template?.body_template || getDefaultTemplate();

    // Conditionals & Placeholders
    subject = evaluateConditionals(subject, reportData);
    html = evaluateConditionals(html, reportData);

    const render = (text: string) => text.replace(/\{(\w+)\}/g, (match, key) => {
      const dataKey = Object.keys(reportData).find(k => k.toLowerCase() === key.toLowerCase());
      return dataKey ? reportData[dataKey] : match;
    });

    subject = render(subject);
    html = render(html);

    // Resolve Recipients
    const emails = await resolveRecipients(supabase, rule);
    if (emails.length === 0) {
      console.log(`  → Skipped: No recipients found`);
      continue;
    }

    // Send Email
    try {
      console.log(`  → Sending email to ${emails.length} recipient(s)...`);
      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: emails.join(', '),
        replyTo,
        subject,
        html,
      });

      console.log(`  ✅ Success: ${info.messageId}`);

      // Log & Update
      await Promise.all([
        ...emails.map(email => supabase.from('email_logs').insert({ 
          rule_id: rule.id, 
          template_id: rule.template_id, 
          recipient_email: email, 
          subject, 
          status: 'sent' 
        })),
        supabase.from('email_schedule_rules').update({ last_sent_at: now.toISOString() }).eq('id', rule.id)
      ]);
    } catch (sendErr: any) {
      console.error(`  ❌ Failed to send email:`, sendErr.message);
      await Promise.all(emails.map(email => supabase.from('email_logs').insert({ 
        rule_id: rule.id, 
        template_id: rule.template_id, 
        recipient_email: email, 
        subject, 
        status: 'failed', 
        error_message: sendErr.message 
      })));
    }
  }

  console.log(`\n[Scheduler] Completed. ${new Date().toISOString()}`);
}

// --- Report Generators ---

async function generateDailyAttendanceReport(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - IST_OFFSET));
  const todayStr = nowIST.toISOString().substring(0, 10);

  const [settingsRes, usersRes, eventsRes, leavesRes] = await Promise.all([
    supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single(),
    supabase.from('users').select('id, name, role:roles(display_name)').neq('role_id', 'unverified'),
    supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', startOfTodayUTC.toISOString()).order('timestamp', { ascending: true }),
    supabase.from('leave_requests').select('user_id').eq('status', 'approved').lte('start_date', todayStr).gte('end_date', todayStr)
  ]);

  const configStartTime = settingsRes.data?.attendance_settings?.office?.fixedOfficeHours?.checkInTime || '09:30';
  const filteredUsers = (usersRes.data || []).filter((u: any) => {
    const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
    return roleName.toLowerCase() !== 'management';
  });
  
  const staffIds = new Set(filteredUsers.map((u: any) => u.id));
  const todayEvents = (eventsRes.data || []).filter((e: any) => staffIds.has(e.user_id));
  const onLeaveUserIds = new Set((leavesRes.data || []).map((l: any) => l.user_id));

  // Inactivity lookback
  const tenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - (9 * 24 * 60 * 60 * 1000));
  const { data: recentEvents } = await supabase.from('attendance_events').select('user_id').gte('timestamp', tenDaysAgoUTC.toISOString());
  const recentlyActiveUserIds = new Set((recentEvents || []).map((e: any) => e.user_id));

  const presentUserIds = new Set<string>();
  const userFirstPunches: Record<string, string> = {};
  todayEvents.forEach((e: any) => {
    presentUserIds.add(e.user_id);
    if (e.type === 'punch-in' && !userFirstPunches[e.user_id]) userFirstPunches[e.user_id] = e.timestamp;
  });

  let lateCount = 0;
  Object.values(userFirstPunches).forEach(ts => {
    const inDate = new Date(new Date(ts).getTime() + IST_OFFSET);
    const inTime = `${String(inDate.getUTCHours()).padStart(2, '0')}:${String(inDate.getUTCMinutes()).padStart(2, '0')}`;
    if (inTime > configStartTime) lateCount++;
  });

  const totalPresent = presentUserIds.size;
  const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
  const inactiveCount = Math.max(0, filteredUsers.length - recentlyActiveUserIds.size);
  const totalAbsent = Math.max(0, filteredUsers.length - totalPresent - onLeaveCount - inactiveCount);

  let tableHtml = '';
  filteredUsers.forEach((user: any, i: number) => {
    let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
    dept = dept.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    let status = 'Present', color = '#16a34a', pin = '—', pout = '—', wh = '—';
    if (presentUserIds.has(user.id)) {
      const inTs = userFirstPunches[user.id];
      const inDate = new Date(new Date(inTs).getTime() + IST_OFFSET);
      pin = format(inDate, 'hh:mm a');
      const inTime = `${String(inDate.getUTCHours()).padStart(2, '0')}:${String(inDate.getUTCMinutes()).padStart(2, '0')}`;
      if (inTime > configStartTime) { status = 'Late'; color = '#d97706'; }
      const lastOut = todayEvents.filter((e: any) => e.user_id === user.id && e.type === 'punch-out').pop();
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

async function resolveRecipients(supabase: any, rule: any): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  return (rule.recipient_type === 'users') ? (await supabase.from('users').select('email').in('id', rule.recipient_user_ids || [])).data?.map((u: any) => u.email).filter(Boolean) || [] : [];
}

function evaluateConditionals(str: string, data: Record<string, string>) {
  return str.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (m, key, op, val2Str, t, f) => {
    const v1 = parseFloat(data[Object.keys(data).find(k=>k.toLowerCase()===key.toLowerCase())||''] || '0');
    const v2 = parseFloat(val2Str);
    let ok = false;
    if(op==='>')ok=v1>v2; else if(op==='<')ok=v1<v2; else if(op==='>=')ok=v1>=v2; else if(op==='<=')ok=v1<=v2; else if(op==='==')ok=v1==v2; else if(op==='!=')ok=v1!=v2;
    return ok ? t : f;
  });
}

function getDefaultTemplate() {
  return `<div style="font-family:sans-serif;max-width:800px;margin:auto;border:1px solid #eee;padding:20px">
    <h2>Report: {date}</h2>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f4f4f4"><th>Metric</th><th>Value</th></tr>
      <tr><td>Attendance</td><td>{attendancePercentage}%</td></tr>
      <tr><td>Present</td><td>{totalPresent}</td></tr>
    </table>
    <div style="margin-top:20px">{table}</div>
  </div>`;
}

// Start Execution
run().catch(err => {
  console.error('[Critical Error]', err);
  process.exit(1);
});
