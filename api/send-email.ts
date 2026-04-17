import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as nodemailer from 'nodemailer';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { format, startOfDay } from 'date-fns';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// Internal Helpers (Simplified)
function getISTDateString(date: any): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return format(new Date(), 'yyyy-MM-dd'); // Fallback to safely formatted current date
    const istDate = new Date(d.getTime() + IST_OFFSET);
    return istDate.toISOString().substring(0, 10);
  } catch {
    return format(new Date(), 'yyyy-MM-dd');
  }
}

function safeFormat(date: any, formatStr: string, fallback = '—') {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch {
    return fallback;
  }
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
  attendance_daily: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    const todayStr = (filters?.dateRange?.start && filters?.dateRange?.end && filters?.dateRange?.start === filters?.dateRange?.end) 
      ? filters.dateRange.start 
      : getISTDateString(nowIST);
    
    const startOfTodayUTC = startOfDay(new Date(new Date(todayStr).getTime()));
    const [settingsRes, usersRes, eventsRes, leavesRes] = await Promise.all([
      supabase.from('settings').select('attendance_settings').eq('id', 'singleton').maybeSingle(),
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
    
    // Apply additional filters from dashboard
    let targetUsers = filteredUsers;
    if (filters?.user?.id) {
      targetUsers = filteredUsers.filter((u: any) => u.id === filters.user.id);
    } else if (filters?.role) {
      targetUsers = filteredUsers.filter((u: any) => {
        const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
        return roleName === filters.role;
      });
    }

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
    targetUsers.forEach((user: any, i: number) => {
      let dept = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
      dept = dept.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      let status = 'Present', color = '#16a34a', pin = '—', pout = '—', wh = '—';
      if (presentUserIds.has(user.id)) {
        const inTs = userFirstPunches[user.id];
        const inDate = new Date(new Date(inTs).getTime() + IST_OFFSET);
        pin = safeFormat(inDate, 'hh:mm a');
        const inTime = !isNaN(inDate.getTime()) ? `${String(inDate.getUTCHours()).padStart(2, '0')}:${String(inDate.getUTCMinutes()).padStart(2, '0')}` : '00:00';
        if (inTime > configStartTime) { status = 'Late'; color = '#d97706'; lateCount++; }
        const lastOut = todayEvents.filter((e: any) => e.user_id === user.id && (e.type === 'punch-out' || e.type === 'check_out')).pop();
        if (lastOut) {
          const outDate = new Date(new Date(lastOut.timestamp).getTime() + IST_OFFSET);
          pout = safeFormat(outDate, 'hh:mm a');
          const diff = new Date(lastOut.timestamp).getTime() - new Date(inTs).getTime();
          wh = !isNaN(diff) ? `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m` : '—';
        }
      } else if (onLeaveUserIds.has(user.id)) { status = 'On Leave'; color = '#2563eb'; }
      else if (recentlyActiveUserIds.has(user.id)) { status = 'Absent'; color = '#dc2626'; }
      else { status = 'Inactive'; color = '#9ca3af'; }
      tableHtml += `<tr style="background:${i%2===0?'#fff':'#f9fafb'}"><td style="border:1px solid #eee;padding:8px">${i+1}</td><td style="border:1px solid #eee;padding:8px;font-weight:500">${user.name}</td><td style="border:1px solid #eee;padding:8px">${dept}</td><td style="border:1px solid #eee;padding:8px">${pin}</td><td style="border:1px solid #eee;padding:8px">${pout}</td><td style="border:1px solid #eee;padding:8px">${wh}</td><td style="border:1px solid #eee;padding:8px;color:${color};font-weight:600">${status}</td></tr>`;
    });
    
    const totalPresent = presentUserIds.size;
    const onLeaveCount = Array.from(onLeaveUserIds).filter(id => staffIds.has(id)).length;
    const totalAbsent = Math.max(0, targetUsers.length - totalPresent - onLeaveCount);

    return {
      date: safeFormat(new Date(todayStr), 'EEEE, MMMM do, yyyy'),
      generatedTime: safeFormat(nowIST, 'hh:mm a'),
      totalEmployees: String(targetUsers.length),
      totalPresent: String(totalPresent),
      totalAbsent: String(totalAbsent),
      lateCount: String(lateCount),
      attendancePercentage: targetUsers.length > 0 ? Math.round((totalPresent/targetUsers.length)*100).toString() : '0',
      onLeaveCount: String(onLeaveCount),
      table: tableHtml || '<tr><td colspan="7">No data</td></tr>'
    };
  },
  attendance_monthly: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    const targetDate = filters?.dateRange?.start ? new Date(filters.dateRange.start) : nowIST;
    const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const monthStr = format(targetDate, 'MMMM yyyy');
    const daysInMonth = lastDayOfMonth.getDate();
    let totalPresentSum = 0;
    const [usersRes, eventsRes] = await Promise.all([
      supabase.from('users').select('id, name').neq('role_id', 'unverified').order('name'),
      supabase.from('attendance_events').select('user_id, type, timestamp').gte('timestamp', firstDayOfMonth.toISOString()).lte('timestamp', lastDayOfMonth.toISOString()),
    ]);
    const users = usersRes.data || [];
    const events = eventsRes.data || [];
    let targetUsers = users;
    if (filters?.user?.id) {
      targetUsers = users.filter(u => u.id === filters.user.id);
    }
    
    let tableHtml = `<table style="width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 9px; border: 1px solid #ddd;"><thead><tr style="background: #e5e7eb; color: #111827;"><th style="border: 1px solid #999; padding: 4px; text-align: left; width: 120px;">Employee Name</th>`;
    for (let d = 1; d <= daysInMonth; d++) tableHtml += `<th style="border: 1px solid #999; padding: 2px; text-align: center; width: 18px;">${String(d).padStart(2, '0')}</th>`;
    tableHtml += `<th style="border: 1px solid #999; padding: 4px; text-align: center; background: #ddd;">Tot</th></tr></thead><tbody>`;
    targetUsers.forEach((user, idx) => {
      tableHtml += `<tr style="background: ${idx % 2 === 0 ? '#fff' : '#f3f4f6'};"><td style="border: 1px solid #bbb; padding: 4px; font-weight: 600;">${user.name}</td>`;
      let presentCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const targetDate = new Date(firstDayOfMonth.getFullYear(), firstDayOfMonth.getMonth(), d);
        const dateStr = safeFormat(targetDate, 'yyyy-MM-dd');
        const hasPunch = events.some(e => e.user_id === user.id && getISTDateString(e.timestamp) === dateStr);
        if (hasPunch) { presentCount++; tableHtml += `<td style="border: 1px solid #bbb; padding: 2px; text-align: center; color: #16a34a; font-weight: bold;">P</td>`; }
        else { tableHtml += `<td style="border: 1px solid #bbb; padding: 2px; text-align: center; color: #dc2626;">A</td>`; }
      }
      tableHtml += `<td style="border: 1px solid #bbb; padding: 4px; text-align: center; font-weight: 900; background: #f3f4f6;">${presentCount}</td></tr>`;
      totalPresentSum += presentCount;
    });
    tableHtml += `</tbody></table>`;
    const totalPossible = targetUsers.length * daysInMonth;
    const attendancePercentage = totalPossible > 0 ? Math.round((totalPresentSum / totalPossible) * 100) : 0;
    const totalAbsent = totalPossible - totalPresentSum;
    return { 
      date: monthStr, 
      reportDate: safeFormat(nowIST, 'dd MMM yyyy'),
      generatedTime: safeFormat(nowIST, 'hh:mm a'),
      totalEmployees: String(targetUsers.length), 
      table: tableHtml,
      attendancePercentage: String(attendancePercentage),
      totalAbsent: String(totalAbsent),
      lateCount: "0",
      totalPresent: String(totalPresentSum)
    };
  },
  document_expiry: async (supabase: SupabaseClient, nowIST: Date, filters?: any) => {
    return { date: format(nowIST, 'yyyy-MM-dd'), items: '0' };
  }
};

async function resolveRecipientsInternal(supabase: SupabaseClient, rule: any): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    // [SECURITY FIX H11] Added is_active=true and is_deleted=false filters
    const { data: users } = await supabase.from('users').select('email')
      .in('role_id', rule.recipient_roles || [])
      .eq('is_active', true)
      .eq('is_deleted', false);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  if (rule.recipient_type === 'users') {
    // [SECURITY FIX H11] Added is_active=true and is_deleted=false filters
    const { data: users } = await supabase.from('users').select('email')
      .in('id', rule.recipient_user_ids || [])
      .eq('is_active', true)
      .eq('is_deleted', false);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  return [];
}

const getSupabaseConfig = (urlOverride?: string, keyOverride?: string) => ({
  url: urlOverride || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  // [SECURITY FIX C7] Removed fallback to VITE_SUPABASE_ANON_KEY
  serviceKey: keyOverride || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
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
  
  let { to, cc, subject, html, ruleId, test, testEmail, smtpConfig, triggerType, reportType, filters } = body;
  
  // Fallback for body vs html naming mismatch
  if (!html && body.body) html = body.body;
  
  // Use provided SMTP config (from UI) or fallback to DB
  const config = smtpConfig || await getSmtpConfig(supabase);
  
  if (!config.user || !config.pass) throw new Error('SMTP credentials not found.');

  if (ruleId) {
    const { data: rule } = await supabase.from('email_schedule_rules').select('*').eq('id', ruleId).single();
    if (!rule) throw new Error('Rule not found');
    
    const { data: template } = rule.template_id ? await supabase.from('email_templates').select('*').eq('id', rule.template_id).single() : { data: null };
    
    const reportTypeKey = rule.report_type?.toLowerCase().replace(/\s+/g, '_');
    const generator = (reportGenerators as any)[reportTypeKey] || reportGenerators.attendance_daily;
    const nowIST = new Date(new Date().getTime() + IST_OFFSET);
    const reportData = await generator(supabase, nowIST);

    const render = (text: string, data: any) => (text || '').replace(/\{(\w+)\}/g, (match, key) => {
      const dataKey = Object.keys(data).find(k => k.toLowerCase() === key.toLowerCase());
      return dataKey ? (data as any)[dataKey] : match;
    });

    // Support for custom message Injection from template variables
    let greetingMessage = `Here is your automated status update for <strong>{date}</strong>. The data below reflects real-time triggers from the Paradigm system as of <strong>{generatedTime} IST</strong>.`;
    if (template?.variables && Array.isArray(template.variables)) {
        const customMsgObj = template.variables.find((v: any) => v.key === '_custom_message');
        if (customMsgObj && customMsgObj.description) {
            let evaluatedMsg = evaluateConditionalsInternal(customMsgObj.description, reportData || {});
            greetingMessage = render(evaluatedMsg.replace(/\n/g, '<br/>'), reportData);
        }
    }
    
    reportData.greetingMessage = greetingMessage;
    reportData.customGreeting = greetingMessage;

    html = template?.body_template;
    if (!html || rule.report_type === 'attendance_monthly') {
        const getMonthlyReportPremiumTemplate = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media only screen and (max-width: 600px) { .stats-container { display: block !important; } .stat-card { margin-bottom: 12px !important; width: 100% !important; } }</style></head><body style="margin: 0; padding: 0; background-color: #f1f5f9;"><div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);"><!-- Header --><div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px; color: white;"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);"><span style="font-size: 24px; font-weight: 800;">PARADIGM</span></div><div style="text-align: right;"><div style="font-size: 11px; opacity: 0.7; text-transform: uppercase; font-weight: 700;">Monthly Report</div><div style="font-size: 16px; font-weight: 600;">{date}</div></div></div></div><div style="padding: 32px;"><div style="margin-bottom: 32px;"><div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Hi,</div><p style="margin: 0; color: #64748b; font-size: 15px; line-height: 1.6;">{greetingMessage}</p></div><div style="margin-bottom: 32px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;"><div style="background: #f8fafc; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;"><h3 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 700;">Attendance Grid</h3></div><div style="overflow-x: auto;">{table}</div></div></div></div></body></html>`;

        const getDefaultPremiumTemplate = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media only screen and (max-width: 600px) { .stats-container { display: block !important; } .stat-card { margin-bottom: 12px !important; width: 100% !important; } }</style></head><body style="margin: 0; padding: 0; background-color: #f1f5f9;"><div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);"><!-- Header --><div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px; color: white;"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);"><span style="font-size: 24px; font-weight: 800;">PARADIGM</span></div><div style="text-align: right;"><div style="font-size: 11px; opacity: 0.7; text-transform: uppercase; font-weight: 700;">Intelligence Report</div><div style="font-size: 16px; font-weight: 600;">{date}</div></div></div></div><div style="padding: 32px;"><div style="margin-bottom: 32px;"><div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Hi,</div><p style="margin: 0; color: #64748b; font-size: 15px; line-height: 1.6;">{greetingMessage}</p></div><div class="stats-container" style="display: flex; gap: 16px; margin-bottom: 32px;"><div class="stat-card" style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center;"><div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Staff Presence</div><div style="font-size: 28px; font-weight: 800; color: #059669;">{attendancePercentage}%</div></div><div class="stat-card" style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center;"><div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Present</div><div style="font-size: 28px; font-weight: 800; color: #10b981;">{totalPresent}</div></div><div class="stat-card" style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center;"><div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Late</div><div style="font-size: 28px; font-weight: 800; color: #f59e0b;">{lateCount}</div></div></div><div style="margin-bottom: 32px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;"><div style="background: #f8fafc; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;"><h3 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 700;">Detailed Overview</h3></div><div style="overflow-x: auto;">{table}</div></div></div></div></body></html>`;

        html = (rule.report_type === 'attendance_monthly') ? getMonthlyReportPremiumTemplate() : getDefaultPremiumTemplate();
    }

    const hasGreetingPlaceholder = html.includes('{greetingMessage}') || html.includes('{customGreeting}');
    if (template?.body_template && !hasGreetingPlaceholder) {
        const greetingBlock = `\n<div style="font-family: Arial, sans-serif; padding: 0 0 20px 0; color: #333; font-size: 14px; line-height: 1.6; text-align: left;">\n  {greetingMessage}\n</div>\n`;
        if (html.toLowerCase().includes('<body')) {
            html = html.replace(/(<body[^>]*>)/i, `$1${greetingBlock}`);
        } else {
            html = greetingBlock + html;
        }
    }

    subject = render(evaluateConditionalsInternal(template?.subject_template || rule.name, reportData), reportData);
    html = render(evaluateConditionalsInternal(html, reportData), reportData);

    if (test && typeof testEmail === 'string' && testEmail.includes('@')) {
      to = [testEmail];
      console.log(`[send-email] Test mode: Overriding recipients with ${testEmail}`);
    } else if (!to || (Array.isArray(to) && to.length === 0)) {
      to = await resolveRecipientsInternal(supabase, rule);
      console.log(`[send-email] Resolved recipients from rule ${ruleId}: ${to.join(', ')}`);
    }

    
    if (!triggerType) triggerType = 'automatic';
  } else if (reportType && triggerType === 'manual') {
    // Handle manual triggers from dashboard without a ruleId
    const reportTypeKey = reportType.toLowerCase().replace(/\s+/g, '_');
    const generator = (reportGenerators as any)[reportTypeKey] || reportGenerators.attendance_daily;
    const nowIST = new Date(new Date().getTime() + IST_OFFSET);
    const reportData = await generator(supabase, nowIST, filters);

    const render = (text: string, data: any) => (text || '').replace(/\{(\w+)\}/g, (match, key) => {
      const dataKey = Object.keys(data).find(k => k.toLowerCase() === key.toLowerCase());
      return dataKey ? (data as any)[dataKey] : match;
    });

    const userMessage = html || ''; // Original message from modal
    const greetingMessage = userMessage || `Here is your requested <strong>${reportType.replace(/_/g, ' ')}</strong> status update for <strong>{date}</strong>.`;
    
    reportData.greetingMessage = greetingMessage;
    reportData.customGreeting = greetingMessage;

    const getDefaultPremiumTemplate = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media only screen and (max-width: 600px) { .stats-container { display: block !important; } .stat-card { margin-bottom: 12px !important; width: 100% !important; } .attendance-table { font-size: 8px !important; } }</style></head><body style="margin: 0; padding: 0; background-color: #f1f5f9;"><div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);"><!-- Header --><div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); padding: 32px; color: white;"><div style="display: flex; justify-content: space-between; align-items: center;"><div style="background: rgba(255,255,255,0.1); padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2);"><span style="font-size: 24px; font-weight: 800;">PARADIGM</span></div><div style="text-align: right;"><div style="font-size: 11px; opacity: 0.7; text-transform: uppercase; font-weight: 700;">${reportType.replace(/_/g, ' ')}</div><div style="font-size: 16px; font-weight: 600;">{date}</div></div></div></div><div style="padding: 32px;"><div style="margin-bottom: 32px;"><div style="font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Hi,</div><p style="margin: 0; color: #64748b; font-size: 15px; line-height: 1.6;">{greetingMessage}</p></div><div style="margin-bottom: 32px; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;"><div style="background: #f8fafc; padding: 16px 24px; border-bottom: 1px solid #e2e8f0;"><h3 style="margin: 0; color: #1e293b; font-size: 16px; font-weight: 700;">Report Overview</h3></div><div style="overflow-x: auto;" class="attendance-table">{table}</div></div></div></div></body></html>`;

    html = render(getDefaultPremiumTemplate(), reportData);
  }

  const toAddresses = (Array.isArray(to) ? to : [to]).filter(e => typeof e === 'string' && e.includes('@'));
  if (toAddresses.length === 0) throw new Error('No valid recipients found');
  const ccAddresses = (Array.isArray(cc) ? cc : [cc]).filter(e => typeof e === 'string' && e.includes('@'));

  const transporter = nodemailer.createTransport({
    host: config.host || config.smtpHost, 
    port: config.port || config.smtpPort, 
    secure: config.secure !== undefined ? config.secure : config.smtpSecure,
    auth: { user: config.user || config.smtpUser, pass: config.pass || config.smtpPass },
    // [SECURITY FIX C6] TLS validation enabled (removed rejectUnauthorized: false)
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
