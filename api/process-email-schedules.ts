import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import { format, startOfDay, isSameDay } from 'date-fns';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function getISTDateString(date: Date): string {
  const istDate = new Date(date.getTime() + IST_OFFSET);
  return istDate.toISOString().substring(0, 10);
}

function evaluateConditionals(str: string, data: Record<string, string>) {
  if (!str) return '';
  return str.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (m, key, op, val2Str, t, f) => {
    const v1 = parseFloat(data[Object.keys(data).find(k=>k.toLowerCase()===key.toLowerCase())||''] || '0');
    const v2 = parseFloat(val2Str);
    let ok = false;
    if(op==='>')ok=v1>v2; else if(op==='<')ok=v1<v2; else if(op==='>=')ok=v1>=v2; else if(op==='<=')ok=v1<=v2; else if(op==='==')ok=v1==v2; else if(op==='!=')ok=v1!=v2;
    return ok ? t : f;
  });
}

// Full Report Generators Logic (Synced with send-email.ts)
const reportGenerators = {
  attendance_daily: async (supabase: SupabaseClient, nowIST: Date) => {
    const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - IST_OFFSET));
    const todayStr = getISTDateString(nowIST);
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
    const tenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - (9 * 24 * 60 * 60 * 1000));
    const { data: recentEvents } = await supabase.from('attendance_events').select('user_id').gte('timestamp', tenDaysAgoUTC.toISOString());
    const recentlyActiveUserIds = new Set((recentEvents || []).map((e: any) => e.user_id));
    const presentUserIds = new Set<string>();
    const userFirstPunches: Record<string, string> = {};
    todayEvents.forEach((e: any) => {
      presentUserIds.add(e.user_id);
      if ((e.type === 'punch-in' || e.type === 'check_in') && !userFirstPunches[e.user_id]) userFirstPunches[e.user_id] = e.timestamp;
    });
    let tableHtml = '';
    let lateCount = 0;
    filteredUsers.forEach((user: any, i: number) => {
      let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
      dept = dept.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      let status = 'Present', color = '#16a34a', pin = '—', pout = '—', wh = '—';
      if (presentUserIds.has(user.id)) {
        const inTs = userFirstPunches[user.id];
        const inDate = new Date(new Date(inTs).getTime() + IST_OFFSET);
        pin = format(inDate, 'hh:mm a');
        const inTime = `${String(inDate.getUTCHours()).padStart(2, '0')}:${String(inDate.getUTCMinutes()).padStart(2, '0')}`;
        if (inTime > configStartTime) { status = 'Late'; color = '#d97706'; lateCount++; }
        const lastOut = todayEvents.filter((e: any) => e.user_id === user.id && (e.type === 'punch-out' || e.type === 'check_out')).pop();
        if (lastOut) {
          pout = format(new Date(new Date(lastOut.timestamp).getTime() + IST_OFFSET), 'hh:mm a');
          const diff = new Date(lastOut.timestamp).getTime() - new Date(inTs).getTime();
          wh = `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`;
        }
      } else if (onLeaveUserIds.has(user.id)) { status = 'On Leave'; color = '#2563eb'; }
      else if (recentlyActiveUserIds.has(user.id)) { status = 'Absent'; color = '#dc2626'; }
      else { status = 'Inactive'; color = '#9ca3af'; }
      tableHtml += `<tr style="background:${i%2===0?'#fff':'#f9fafb'}"><td style="border:1px solid #ee;padding:8px">${i+1}</td><td style="border:1px solid #eee;padding:8px;font-weight:500">${user.name}</td><td style="border:1px solid #eee;padding:8px">${dept}</td><td style="border:1px solid #eee;padding:8px">${pin}</td><td style="border:1px solid #eee;padding:8px">${pout}</td><td style="border:1px solid #eee;padding:8px">${wh}</td><td style="border:1px solid #eee;padding:8px;color:${color};font-weight:600">${status}</td></tr>`;
    });
    const totalPresent = presentUserIds.size;
    const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
    return {
      date: format(nowIST, 'EEEE, MMMM do, yyyy'),
      generatedTime: format(nowIST, 'hh:mm a'),
      totalEmployees: String(filteredUsers.length),
      totalPresent: String(totalPresent),
      totalAbsent: String(Math.max(0, filteredUsers.length - totalPresent - onLeaveCount)),
      lateCount: String(lateCount),
      attendancePercentage: filteredUsers.length > 0 ? Math.round((totalPresent/filteredUsers.length)*100).toString() : '0',
      onLeaveCount: String(onLeaveCount),
      table: tableHtml || '<tr><td colspan="7">No data</td></tr>'
    };
  },
  attendance_monthly: async (supabase: SupabaseClient, nowIST: Date) => {
    const firstDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth(), 1);
    const lastDayOfMonth = new Date(nowIST.getFullYear(), nowIST.getMonth() + 1, 0);
    const monthStr = format(nowIST, 'MMMM yyyy');
    const daysInMonth = lastDayOfMonth.getDate();
    const [usersRes, eventsRes] = await Promise.all([
      supabase.from('users').select('id, name').neq('role_id', 'unverified').order('name'),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', firstDayOfMonth.toISOString()).lte('timestamp', lastDayOfMonth.toISOString()),
    ]);
    const users = usersRes.data || [];
    const events = eventsRes.data || [];
    let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 9px; border: 1px solid #ddd;"><thead><tr style="background: #e5e7eb; color: #111827;"><th style="border: 1px solid #999; padding: 4px; text-align: left; width: 120px;">Employee Name</th>`;
    for (let d = 1; d <= daysInMonth; d++) tableHtml += `<th style="border: 1px solid #999; padding: 2px; text-align: center; width: 18px;">${String(d).padStart(2, '0')}</th>`;
    tableHtml += `<th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ddd;">Tot</th></tr></thead><tbody>`;
    users.forEach((user, idx) => {
      tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f3f4f6'};"><td style="border: 1px solid #bbb; padding: 4px; font-weight: 600;">${user.name}</td>`;
      let presentCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = format(new Date(nowIST.getFullYear(), nowIST.getMonth(), d), 'yyyy-MM-dd');
        const hasPunch = events.some(e => e.user_id === user.id && getISTDateString(new Date(e.timestamp)) === dateStr);
        if (hasPunch) { presentCount++; tableHtml += `<td style="border: 1px solid #bbb; padding: 2px; text-align: center; color: #16a34a; font-weight: bold;">P</td>`; }
        else { tableHtml += `<td style="border: 1px solid #bbb; padding: 2px; text-align: center; color: #dc2626;">A</td>`; }
      }
      tableHtml += `<td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: 900; background: #f3f4f6;">${presentCount}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;
    return { date: monthStr, totalEmployees: String(users.length), table: tableHtml };
  },
  document_expiry: async (s:any,now:any) => { return {date:format(now,'yyyy-MM-dd')}; }
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  console.log('[process-email-schedules] Triggered AUTOMATIC sync process...');
  const timeoutLimit = 8500;
  const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_LIMIT_REACHED')), timeoutLimit));

  try {
    const result = await Promise.race([processSchedules(req), timeoutPromise]);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[process-email-schedules] Critical Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

async function processSchedules(req: VercelRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  // Get email config
  const { data: settings } = await supabase.from('settings').select('email_config').eq('id', 'singleton').single();
  const emailConfig = settings?.email_config;
  if (!emailConfig?.user || !emailConfig?.pass || !emailConfig?.enabled) return { message: 'Email disabled', processed: 0 };

  // Get active rules
  const ruleId = req.query.ruleId as string;
  const force = req.query.force === 'true';
  let query = supabase.from('email_schedule_rules').select('*').eq('is_active', true);
  if (ruleId) query = query.eq('id', ruleId);
  const { data: rules } = await query;
  if (!rules || rules.length === 0) return { message: 'No active schedules', processed: 0 };

  const { data: templates } = await supabase.from('email_templates').select('*');
  const templateMap = new Map((templates || []).map(t => [t.id, t]));

  const transporter = nodemailer.createTransport({
    host: emailConfig.host || 'smtp.gmail.com',
    port: emailConfig.port || 587,
    secure: emailConfig.secure || false,
    auth: { user: emailConfig.user, pass: emailConfig.pass },
    // [SECURITY FIX C6] TLS validation enabled (removed rejectUnauthorized: false)
  });

  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  let totalSent = 0;

  for (const rule of rules) {
    const isForceRun = force || ruleId === rule.id;
    if (rule.trigger_type === 'scheduled' && !isForceRun) {
      const config = rule.schedule_config || {};
      const [hour, minute] = (config.time || '21:00').split(':').map(Number);
      if (nowIST.getUTCHours() < hour || (nowIST.getUTCHours() === hour && nowIST.getUTCMinutes() < minute)) continue;
      if (rule.last_sent_at && isSameDay(new Date(new Date(rule.last_sent_at).getTime() + IST_OFFSET), nowIST)) continue;
    }

    // Resolve Recipients
    let emails: string[] = [];
    if (rule.recipient_type === 'custom_emails') emails = rule.recipient_emails || [];
    else if (rule.recipient_type === 'role') {
      const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []).eq('is_active', true);
      emails = (users || []).map((u: any) => u.email).filter(Boolean);
    } else if (rule.recipient_type === 'users') {
      const { data: users } = await supabase.from('users').select('email').in('id', rule.recipient_user_ids || []);
      emails = (users || []).map((u: any) => u.email).filter(Boolean);
    }
    
    if (emails.length === 0) {
      console.log(`[Schedule] Skipping "${rule.name}" - No recipients resolved.`);
      continue;
    }

    // Generate Data
    const generator = (reportGenerators as any)[rule.report_type] || reportGenerators.attendance_daily;
    const reportData = await generator(supabase, nowIST);

    const template = templateMap.get(rule.template_id);
    if (template?.variables) {
      const customVar = (template.variables as any[]).find(v => v.key === '_custom_message' || v.key === 'customMessage');
      if (customVar) { reportData.customGreeting = customVar.description; reportData.customMessage = customVar.description; }
    }

    let subject = template?.subject_template || rule.name;
    let html = template?.body_template || `<h2>Report</h2>{table}`;

    subject = evaluateConditionals(subject, reportData);
    html = evaluateConditionals(html, reportData);

    const render = (text: string) => text.replace(/\{(\w+)\}/g, (match, key) => {
      const dataKey = Object.keys(reportData).find(k => k.toLowerCase() === key.toLowerCase());
      return dataKey ? (reportData as any)[dataKey] : match;
    });
    subject = render(subject);
    html = render(html);

    try {
      await transporter.sendMail({
        from: `"${emailConfig.from_name || 'Paradigm FMS'}" <${emailConfig.from_email || emailConfig.user}>`,
        to: emails.join(', '),
        replyTo: emailConfig.reply_to || emailConfig.from_email,
        subject, html
      });
      await Promise.all([
        ...emails.map(email => supabase.from('email_logs').insert({ rule_id: rule.id, template_id: rule.template_id, recipient_email: email, subject, status: 'sent', metadata: { trigger_type: 'automatic' } })),
        supabase.from('email_schedule_rules').update({ last_sent_at: now.toISOString() }).eq('id', rule.id)
      ]);
      totalSent += emails.length;
    } catch (mailErr: any) {
      await Promise.all(emails.map(email => supabase.from('email_logs').insert({ rule_id: rule.id, recipient_email: email, subject, status: 'failed', error_message: mailErr.message, metadata: { trigger_type: 'automatic' } })));
    }
  }
  return { success: true, processed: totalSent };
}
