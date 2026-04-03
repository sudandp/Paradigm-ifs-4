import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import { format, startOfDay, isSameDay } from 'date-fns';

// Helper: Stub frontend-only functions to prevent build failures
const dispatchNotificationFromRules = async (...args: any[]) => console.log('Notification dispatch stubbed in backend', ...args);
const calculateSiteTravelTime = (events: any[]) => ({ totalHours: 0, siteHours: 0, travelHours: 0, sitePercentage: 0, travelPercentage: 0, siteVisits: 0 });
const validateFieldStaffAttendance = (breakdown: any, rules: any) => ({ isValid: true, violations: [] });
const getProxyUrl = (url: string) => url;
const toSnakeCase = (obj: any) => obj;
const toCamelCase = (obj: any) => obj;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  console.log('[process-email-schedules] Starting Version 2.1 (Performance + Timeout Fix)...');
  
  const timeoutLimit = 8500; // 8.5 seconds soft limit for Vercel
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('TIMEOUT_LIMIT_REACHED')), timeoutLimit)
  );

  try {
    const result = await Promise.race([
      processSchedules(req),
      timeoutPromise
    ]);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[process-email-schedules] Critical Error:', error.message);
    if (error.message === 'TIMEOUT_LIMIT_REACHED') {
      return res.status(504).json({ 
        error: 'Execution Timed Out', 
        message: 'The report generation exceeded 8.5 seconds. Please optimize your data size or split rule processing.' 
      });
    }
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

async function processSchedules(req: VercelRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Security Check (Internal API Key or Vercel Cron Secret)
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];
  const queryKey = req.query.key as string;
  const internalKey = process.env.INTERNAL_API_KEY;
  const cronSecret = process.env.CRON_SECRET;

  const isInternal = internalKey && (apiKey === internalKey || queryKey === internalKey);
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (internalKey && !isInternal && !isVercelCron) {
    throw new Error('Unauthorized');
  }

  // 1. Get email config from settings
  console.time('fetch_settings');
  const { data: settings } = await supabase.from('settings').select('email_config').eq('id', 'singleton').single();
  console.timeEnd('fetch_settings');

  const emailConfig = settings?.email_config;
  if (!emailConfig?.user || !emailConfig?.pass || !emailConfig?.enabled) {
    return { message: 'Email not configured or disabled', processed: 0 };
  }

  // 2. Get active schedule rules
  const ruleId = req.query.ruleId as string;
  const force = req.query.force === 'true';

  let query = supabase.from('email_schedule_rules').select('*').eq('is_active', true);
  if (ruleId) query = query.eq('id', ruleId);
  const { data: rules, error: rulesErr } = await query;
  if (rulesErr) throw rulesErr;
  if (!rules || rules.length === 0) return { message: 'No active email schedules', processed: 0 };

  // 3. Get all templates and Create SMTP transporter
  console.time('fetch_templates');
  const { data: templates } = await supabase.from('email_templates').select('*');
  console.timeEnd('fetch_templates');
  const templateMap = new Map((templates || []).map(t => [t.id, t]));

  const transporter = nodemailer.createTransport({
    host: emailConfig.host || 'smtp.gmail.com',
    port: emailConfig.port || 587,
    secure: emailConfig.secure || false,
    auth: { user: emailConfig.user, pass: emailConfig.pass },
  });

  const fromAddress = `"${emailConfig.from_name || 'Paradigm FMS'}" <${emailConfig.from_email || emailConfig.user}>`;
  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  let totalSent = 0;

  for (const rule of rules) {
    console.log(`[Schedule] Processing: "${rule.name}"`);
    const isForceRun = force || ruleId === rule.id;

    // Trigger check
    if (rule.trigger_type === 'scheduled' && !isForceRun) {
      const { shouldRun, reason } = shouldRunScheduleWithStatus(rule, nowIST);
      if (!shouldRun) {
        console.log(`  → Skipped: ${reason}`);
        continue;
      }
      
      // Strict Daily check
      if (rule.last_sent_at) {
        const lastSentDate = new Date(rule.last_sent_at);
        const lastSentIST = new Date(lastSentDate.getTime() + IST_OFFSET);
        if (isSameDay(lastSentIST, nowIST)) {
          console.log(`  → Skipped (Already sent for today: ${rule.last_sent_at})`);
          continue;
        }
      }
    }

    // Generate report data
    console.time(`gen_${rule.report_type}`);
    let reportData: Record<string, string> = { date: format(nowIST, 'EEEE, MMMM do, yyyy') };
    if (rule.report_type === 'attendance_daily') reportData = await generateDailyAttendanceReport(supabase, nowIST);
    else if (rule.report_type === 'attendance_monthly') reportData = await generateMonthlyAttendanceReport(supabase, nowIST);
    else if (rule.report_type === 'document_expiry') reportData = await generateDocumentExpiryReport(supabase, nowIST);
    else if (rule.report_type === 'pending_approvals') reportData = await generatePendingApprovalsReport(supabase);
    console.timeEnd(`gen_${rule.report_type}`);

    // Render template
    const template = templateMap.get(rule.template_id);
    let subject = template?.subject_template || rule.name;
    let html = template?.body_template || getDefaultPremiumTemplate();

    // 1. Evaluate conditionals first
    subject = evaluateConditionals(subject, reportData);
    html = evaluateConditionals(html, reportData);

    // 2. Single-pass Placeholder replacement (Optimized)
    const render = (text: string) => text.replace(/\{(\w+)\}/g, (match, key) => {
      // Direct lookup or check reportData (case-insensitive for keys)
      const dataKey = Object.keys(reportData).find(k => k.toLowerCase() === key.toLowerCase());
      return dataKey ? reportData[dataKey] : match;
    });

    subject = render(subject);
    html = render(html);

    // Resolve recipients
    const emails = await resolveRecipients(supabase, rule);
    if (emails.length === 0) continue;

    // Send Mail
    try {
      console.time(`send_mail_${rule.id}`);
      await transporter.sendMail({
        from: fromAddress,
        to: emails.join(', '),
        replyTo: emailConfig.reply_to || emailConfig.from_email || emailConfig.user,
        subject,
        html,
      });
      console.timeEnd(`send_mail_${rule.id}`);

      // Log success and update rule
      await Promise.all([
        ...emails.map(email => supabase.from('email_logs').insert({ rule_id: rule.id, template_id: rule.template_id, recipient_email: email, subject, status: 'sent', trigger_type: 'automatic' })),
        supabase.from('email_schedule_rules').update({ last_sent_at: now.toISOString() }).eq('id', rule.id)
      ]);
      totalSent += emails.length;
    } catch (mailErr: any) {
      console.error(`  → Mail failed:`, mailErr.message);
      await Promise.all(emails.map(email => supabase.from('email_logs').insert({ rule_id: rule.id, template_id: rule.template_id, recipient_email: email, subject, status: 'failed', error_message: mailErr.message, trigger_type: 'automatic' })));
    }
  }

  return { success: true, processed: totalSent };
}

function shouldRunScheduleWithStatus(rule: any, nowIST: Date): { shouldRun: boolean; reason: string } {
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

async function resolveRecipients(supabase: any, rule: any): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []).eq('is_active', true);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  return (rule.recipient_type === 'users') ? (await supabase.from('users').select('email').in('id', rule.recipient_user_ids || [])).data?.map((u: any) => u.email).filter(Boolean) || [] : [];
}

async function generateDailyAttendanceReport(supabase: any, nowIST: Date): Promise<Record<string, any>> {
  const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - IST_OFFSET));
  const todayStr = format(nowIST, 'yyyy-MM-dd');

  const [settingsRes, usersRes, eventsRes, leavesRes] = await Promise.all([
    supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single(),
    supabase.from('users').select('id, name, employee_id, role:roles(display_name)').eq('is_active', true).order('name'),
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

  // 10-day lookback for inactivity (Optimized fetch)
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
    if (format(new Date(new Date(ts).getTime() + IST_OFFSET), 'HH:mm') > configStartTime) lateCount++;
  });

  const totalPresent = presentUserIds.size;
  const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
  const inactiveCount = Math.max(0, filteredUsers.length - recentlyActiveUserIds.size);
  const totalAbsent = Math.max(0, filteredUsers.length - totalPresent - onLeaveCount - inactiveCount);

  let tableHtml = '';
  filteredUsers.forEach((user: any, i: number) => {
    let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
    dept = dept.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    let status = 'Present', color = '#16a34a', pin = '—', pout = '—', wh = '—';
    if (presentUserIds.has(user.id)) {
      const inTs = userFirstPunches[user.id];
      const inDate = new Date(new Date(inTs).getTime() + IST_OFFSET);
      pin = format(inDate, 'hh:mm a');
      if (format(inDate, 'HH:mm') > configStartTime) { status = 'Late'; color = '#d97706'; }
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

// ... Additional report generators stubs or logic here ...
async function generateMonthlyAttendanceReport(s:any,now:any){ return {date:format(now,'yyyy-MM')}; }
async function generateDocumentExpiryReport(s:any,now:any){ return {date:format(now,'yyyy-MM-dd')}; }
async function generatePendingApprovalsReport(s:any){ return {items:'0'}; }

function evaluateConditionals(str: string, data: Record<string, string>) {
  return str.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (m, key, op, val2Str, t, f) => {
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
