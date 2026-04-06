import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as nodemailer from 'nodemailer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { format, startOfDay } from 'date-fns';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// Internal Helpers (Simplified)
function getISTDateString(date: Date): string {
  const istDate = new Date(date.getTime() + IST_OFFSET);
  return istDate.toISOString().substring(0, 10);
}

function evaluateConditionalsInternal(str: string, data: Record<string, string>) {
  if (!str) return '';
  return str.replace(/\{(\w+)\s*([><!=]=?)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, (m, key, op, val2Str, t, f) => {
    const v1 = parseFloat(data[Object.keys(data).find(k=>k.toLowerCase()===key.toLowerCase())||''] || '0');
    const v2 = parseFloat(val2Str);
    let ok = false;
    if(op==='>')ok=v1>v2; else if(op==='<')ok=v1<v2; else if(op==='>=')ok=v1>=v2; else if(op==='<=')ok=v1<=v2; else if(op==='==')ok=v1==v2; else if(op==='!=')ok=v1!=v2;
    return ok ? t : f;
  });
}

// Inlined Report Generators to avoid import crashes
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
      dept = dept.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
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
      tableHtml += `<tr style="background:${i%2===0?'#fff':'#f9fafb'}"><td style="border:1px solid #eee;padding:8px">${i+1}</td><td style="border:1px solid #eee;padding:8px;font-weight:500">${user.name}</td><td style="border:1px solid #eee;padding:8px">${dept}</td><td style="border:1px solid #eee;padding:8px">${pin}</td><td style="border:1px solid #eee;padding:8px">${pout}</td><td style="border:1px solid #eee;padding:8px">${wh}</td><td style="border:1px solid #eee;padding:8px;color:${color};font-weight:600">${status}</td></tr>`;
    });
    
    const totalPresent = presentUserIds.size;
    const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
    const totalAbsent = Math.max(0, filteredUsers.length - totalPresent - onLeaveCount);

    return {
      date: format(nowIST, 'EEEE, MMMM do, yyyy'),
      generatedTime: format(nowIST, 'hh:mm a'),
      totalEmployees: String(filteredUsers.length),
      totalPresent: String(totalPresent),
      totalAbsent: String(totalAbsent),
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
  document_expiry: async (supabase: SupabaseClient, nowIST: Date) => {
    return { date: format(nowIST, 'yyyy-MM-dd'), items: '0' };
  }
};

async function resolveRecipientsInternal(supabase: SupabaseClient, rule: any): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  if (rule.recipient_type === 'users') {
    const { data: users } = await supabase.from('users').select('email').in('id', rule.recipient_user_ids || []);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  return [];
}

const getSupabaseConfig = (urlOverride?: string, keyOverride?: string) => ({
  url: urlOverride || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  serviceKey: keyOverride || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
});

async function getSmtpConfig(supabase: SupabaseClient) {
  const { data } = await supabase.from('settings').select('email_config').eq('id', 'singleton').maybeSingle();
  const cfg = data?.email_config || {};
  return {
    host: cfg.host || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(cfg.port || process.env.SMTP_PORT || '587'),
    secure: cfg.secure ?? (process.env.SMTP_SECURE === 'true' || false),
    user: cfg.user || process.env.SMTP_USER || '',
    pass: cfg.pass || process.env.SMTP_PASS || '',
    fromEmail: cfg.from_email || cfg.user || process.env.SMTP_FROM_EMAIL || '',
    fromName: cfg.from_name || 'Paradigm FMS',
    replyTo: cfg.reply_to || cfg.from_email
  };
}

export async function sendEmailLogic(body: any, supabaseUrl?: string, supabaseServiceKey?: string) {
  const { url, serviceKey } = getSupabaseConfig(supabaseUrl, supabaseServiceKey);
  const supabase = createClient(url, serviceKey);
  
  let { to, cc, subject, html, ruleId, test, testEmail, smtpConfig, triggerType } = body;
  
  // Use provided SMTP config (from UI) or fallback to DB
  const config = smtpConfig || await getSmtpConfig(supabase);
  
  if (!config.user || !config.pass) throw new Error('SMTP credentials not found.');

  if (ruleId) {
    const { data: rule } = await supabase.from('email_schedule_rules').select('*').eq('id', ruleId).single();
    if (!rule) throw new Error('Rule not found');
    
    const { data: template } = rule.template_id ? await supabase.from('email_templates').select('*').eq('id', rule.template_id).single() : { data: null };
    
    const generator = (reportGenerators as any)[rule.report_type] || reportGenerators.attendance_daily;
    const nowIST = new Date(new Date().getTime() + IST_OFFSET);
    const reportData = await generator(supabase, nowIST);

    // Support for custom message Injection from template variables
    if (template?.variables) {
       const customMsgVar = template.variables.find((v: any) => v.key === '_custom_message' || v.key === 'customMessage');
       if (customMsgVar) reportData.customMessage = customMsgVar.description;
    }

    subject = evaluateConditionalsInternal(template?.subject_template || rule.name, reportData);
    html = evaluateConditionalsInternal(template?.body_template || '<h2>Report</h2>{table}', reportData);

    const render = (text: string) => text.replace(/\{(\w+)\}/g, (match, key) => {
      const dataKey = Object.keys(reportData).find(k => k.toLowerCase() === key.toLowerCase());
      return dataKey ? (reportData as any)[dataKey] : match;
    });
    subject = render(subject);
    html = render(html);

    if (test && testEmail) to = [testEmail];
    else if (!to) to = await resolveRecipientsInternal(supabase, rule);
    
    if (!triggerType) triggerType = 'automatic';
  }

  const toAddresses = (Array.isArray(to) ? to : [to]).filter(e => typeof e === 'string' && e.includes('@'));
  if (toAddresses.length === 0) throw new Error('No valid recipients found');
  const ccAddresses = (Array.isArray(cc) ? cc : [cc]).filter(e => typeof e === 'string' && e.includes('@'));

  const transporter = nodemailer.createTransport({
    host: config.host || config.smtpHost, 
    port: config.port || config.smtpPort, 
    secure: config.secure !== undefined ? config.secure : config.smtpSecure,
    auth: { user: config.user || config.smtpUser, pass: config.pass || config.smtpPass },
    tls: { rejectUnauthorized: false }
  });

  const fromEmail = (config.fromEmail || config.smtpFromEmail || config.user || config.smtpUser || '').toLowerCase();
  
  const mailOptions: any = {
    from: `"${config.fromName || config.smtpFromName || 'Paradigm FMS'}" <${fromEmail}>`,
    to: toAddresses.join(', '),
    subject, 
    html, 
    replyTo: config.replyTo || config.smtpReplyTo || fromEmail
  };
  if (ccAddresses.length > 0) mailOptions.cc = ccAddresses.join(', ');

  const info = await transporter.sendMail(mailOptions);

  // Log successful delivery - Removing trigger_type column (missing in DB) and using metadata instead
  try {
    await Promise.all(toAddresses.map(email => 
      supabase.from('email_logs').insert({
        recipient_email: email, 
        subject, 
        status: 'sent', 
        rule_id: ruleId || null, 
        metadata: { 
          trigger_type: triggerType || 'manual',
          vercel_env: process.env.VERCEL_ENV || 'development'
        },
        created_at: new Date().toISOString()
      })
    ));
  } catch (logLog) {
    console.error('[send-email] Logging failed but email was likely sent:', logLog);
  }
  
  return info;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  
  try {
    const { url, serviceKey } = getSupabaseConfig();
    const info = await sendEmailLogic(req.body, url, serviceKey);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error('[send-email] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
}
