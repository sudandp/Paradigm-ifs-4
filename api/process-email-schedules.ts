import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';

// Helper: Stub frontend-only functions to prevent build failures
const dispatchNotificationFromRules = async (...args: any[]) => console.log('Notification dispatch stubbed in backend', ...args);
const calculateSiteTravelTime = (events: any[]) => ({ totalHours: 0, siteHours: 0, travelHours: 0, sitePercentage: 0, travelPercentage: 0, siteVisits: 0 });
const validateFieldStaffAttendance = (breakdown: any, rules: any) => ({ isValid: true, violations: [] });
const getProxyUrl = (url: string) => url;
const toSnakeCase = (obj: any) => obj;
const toCamelCase = (obj: any) => obj;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  console.log('[process-email-schedules] Starting Version 2.0 (Config Fix)...');

  // Security Check (Internal API Key or Vercel Cron Secret)
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers['authorization'];
  const queryKey = req.query.key as string;
  const internalKey = process.env.INTERNAL_API_KEY;
  const cronSecret = process.env.CRON_SECRET;

  const isInternal = internalKey && (apiKey === internalKey || queryKey === internalKey);
  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (internalKey && !isInternal && !isVercelCron) {
    console.warn('[process-email-schedules] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Get email config from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('email_config')
      .eq('id', 'singleton')
      .single();

    const emailConfig = settings?.email_config;
    if (!emailConfig?.user || !emailConfig?.pass || !emailConfig?.enabled) {
      return res.status(200).json({ message: 'Email not configured or disabled', processed: 0 });
    }

    // 2. Get active schedule rules
    const ruleId = req.query.ruleId as string;
    const force = req.query.force === 'true';

    let query = supabase.from('email_schedule_rules').select('*').eq('is_active', true);
    if (ruleId) query = query.eq('id', ruleId);
    
    const { data: rules, error: rulesErr } = await query;

    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return res.status(200).json({ message: ruleId ? `Rule ${ruleId} not found or inactive` : 'No active email schedules', processed: 0 });
    }

    // 3. Get all templates
    const { data: templates } = await supabase
      .from('email_templates')
      .select('*');

    const templateMap = new Map((templates || []).map(t => [t.id, t]));

    // 4. Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: emailConfig.host || 'smtp.gmail.com',
      port: emailConfig.port || 587,
      secure: emailConfig.secure || false,
      auth: { user: emailConfig.user, pass: emailConfig.pass },
    });

    const fromAddress = `"${emailConfig.from_name || 'Paradigm FMS'}" <${emailConfig.from_email || emailConfig.user}>`;

    // IST time helpers
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);

    let totalSent = 0;

    for (const rule of rules) {
      console.log(`[Schedule] Processing: "${rule.name}" (trigger: ${rule.trigger_type})`);

      // Check if should run now (for scheduled type)
      if (rule.trigger_type === 'scheduled') {
        const isForceRun = force || ruleId === rule.id;
        const { shouldRun, reason } = shouldRunScheduleWithStatus(rule, nowIST);
        
        if (!shouldRun && !isForceRun) {
          console.log(`  → Skipped (${reason})`);
          continue;
        }

        // Check if already sent today - strictly enforced for scheduled reports
        if (rule.last_sent_at) {
           const lastSentDate = new Date(rule.last_sent_at);
           if (isSameDay(lastSentDate, nowIST) && !isForceRun) {
             console.log(`  → Skipped (Already sent for today: ${rule.last_sent_at})`);
             continue;
           }
        }
        
        if (isForceRun) console.log(`  → TRIGGERED! (Force/Test mode enabled)`);
        else console.log(`  → TRIGGERED! Sending report now because: ${reason}`);
      }

      // Get template
      const template = templateMap.get(rule.template_id);

      // Generate report data
      let reportData: Record<string, string> = {
        date: format(nowIST, 'EEEE, MMMM do, yyyy'),
        subject: rule.name,
        message: '',
      };

      if (rule.report_type === 'attendance_daily') {
        reportData = await generateDailyAttendanceReport(supabase, nowIST, istOffset);
      } else if (rule.report_type === 'attendance_monthly') {
        reportData = await generateMonthlyAttendanceReport(supabase, nowIST, istOffset);
      } else if (rule.report_type === 'document_expiry') {
        reportData = await generateDocumentExpiryReport(supabase, nowIST);
      } else if (rule.report_type === 'pending_approvals') {
        reportData = await generatePendingApprovalsReport(supabase);
      }

      const customMessageVar = (Array.isArray(template?.variables)) ? template?.variables?.find((v: any) => v.key === '_custom_message') : null;
      const customMessage = customMessageVar?.description || "Greetings from Paradigm! 👋\nWe hope you're having a fantastic day. Here is your report! 🚀";
      const [headerText, ...bodyParts] = (customMessage || "").split('\n');
      const bodyText = bodyParts.join('<br />');

      // Render template
      const premiumTemplate = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 900px; margin: auto; border: 1px solid #d1d5db; background: #ffffff;">
  <div style="padding: 18px 24px; border-bottom: 3px solid #111827;">
    <table style="width: 100%;">
      <tr>
        <td>
          <h2 style="margin: 0; font-size: 20px; color: #111827;">PARADIGM FMS</h2>
          <p style="margin: 2px 0 0; font-size: 12px; color: #6b7280;">Attendance Management System</p>
        </td>
        <td style="text-align: right;">
          <p style="margin: 0; font-size: 12px;"><strong>Report Date:</strong> {date}</p>
          <p style="margin: 2px 0 0; font-size: 12px;"><strong>Generated On:</strong> {generatedTime}</p>
        </td>
      </tr>
    </table>
  </div>
  <div style="padding: 24px 24px 8px;">
    ${headerText ? `<h2 style="margin: 0 0 8px; font-size: 18px; color: #111827;">${headerText}</h2>` : ''}
    ${bodyText ? `<p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5;">${bodyText}</p>` : ''}
  </div>
  <div style="padding: 16px 24px; border-bottom: 1px solid #e5e7eb;">
    <h3 style="margin: 0; font-size: 16px; color: #1f2937;">Daily Attendance Summary</h3>
  </div>
  <div style="padding: 16px 24px;">
    <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 13px;">
      <tr style="background: #f9fafb;">
        <th style="border: 1px solid #e5e7eb; padding: 10px;">Total Employees</th>
        <th style="border: 1px solid #e5e7eb; padding: 10px;">Present</th>
        <th style="border: 1px solid #e5e7eb; padding: 10px;">Absent</th>
        <th style="border: 1px solid #e5e7eb; padding: 10px;">Late</th>
        <th style="border: 1px solid #e5e7eb; padding: 10px;">Attendance %</th>
      </tr>
      <tr>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">{totalEmployees}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px; color: #16a34a; font-weight: bold;">{totalPresent}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px; color: #dc2626; font-weight: bold;">{totalAbsent}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px; color: #d97706; font-weight: bold;">{lateCount}</td>
        <td style="border: 1px solid #e5e7eb; padding: 10px;">{attendancePercentage}%</td>
      </tr>
    </table>
  </div>
  <div style="padding: 16px 24px;">
    <h4 style="margin: 0 0 10px; font-size: 14px; color: #111827;">Employee Attendance Details</h4>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: center;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="border: 1px solid #e5e7eb; padding: 8px;">S.No</th>
          <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Employee Name</th>
          <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Department</th>
          <th style="border: 1px solid #e5e7eb; padding: 8px;">Check-In</th>
          <th style="border: 1px solid #e5e7eb; padding: 8px;">Check-Out</th>
          <th style="border: 1px solid #e5e7eb; padding: 8px;">Work Hours</th>
          <th style="border: 1px solid #e5e7eb; padding: 8px;">Status</th>
        </tr>
      </thead>
      <tbody>
        {table}
      </tbody>
    </table>
  </div>
  <div style="padding: 12px 24px; border-top: 1px solid #e5e7eb;">
    <p style="margin: 0; font-size: 11px; color: #6b7280;">
      * Late is calculated based on shift start time. Attendance percentage is calculated as (Present / Total Employees) × 100.
    </p>
  </div>
  <div style="padding: 16px 24px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
    <table style="width: 100%; font-size: 11px;">
      <tr>
        <td style="color: #9ca3af;">Generated by <strong>Paradigm FMS</strong></td>
        <td style="text-align: right; color: #9ca3af;">Confidential Internal Report</td>
      </tr>
    </table>
  </div>
</div>`;

      let subject = template?.subject_template || rule.name;
      let html = template?.body_template || premiumTemplate;

      subject = evaluateConditionals(subject, reportData);
      html = evaluateConditionals(html, reportData);

      for (const [key, value] of Object.entries(reportData)) {
        subject = subject.replace(new RegExp(`\\{${key}\\}`, 'ig'), value);
        html = html.replace(new RegExp(`\\{${key}\\}`, 'ig'), value);
      }

      const emails = await resolveRecipients(supabase, rule);
      if (emails.length === 0) continue;

      try {
        await transporter.sendMail({
          from: fromAddress,
          to: emails.join(', '),
          replyTo: emailConfig.reply_to || emailConfig.from_email || emailConfig.user,
          subject,
          html,
        });

        for (const email of emails) {
          await supabase.from('email_logs').insert({
            rule_id: rule.id,
            template_id: rule.template_id,
            recipient_email: email,
            subject,
            status: 'sent',
          });
        }

        await supabase.from('email_schedule_rules')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', rule.id);

        totalSent += emails.length;
      } catch (mailErr: any) {
        for (const email of emails) {
          await supabase.from('email_logs').insert({
            rule_id: rule.id,
            template_id: rule.template_id,
            recipient_email: email,
            subject,
            status: 'failed',
            error_message: mailErr.message,
          });
        }
      }
    }

    return res.status(200).json({ success: true, processed: totalSent });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

function evaluateConditionals(str: string, reportData: Record<string, string>) {
    return str.replace(/\{([a-zA-Z0-9_]+)\s*([><]=?|==|!=)\s*([0-9.]+)\s*\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']\}/ig, 
      (match, varName, operator, val2Str, trueStr, falseStr) => {
        const dataKey = Object.keys(reportData).find(k => k.toLowerCase() === varName.toLowerCase());
        if (!dataKey) return match;
        const val1 = parseFloat(reportData[dataKey]);
        const val2 = parseFloat(val2Str);
        let condition = false;
        if (operator === '>') condition = val1 > val2;
        if (operator === '<') condition = val1 < val2;
        if (operator === '>=') condition = val1 >= val2;
        if (operator === '<=') condition = val1 <= val2;
        if (operator === '==') condition = val1 == val2;
        if (operator === '!=') condition = val1 != val2;
        return condition ? trueStr : falseStr;
    });
}

/**
 * Enhanced schedule checker that supports Vercel Daily Crons.
 * Logic: "Should I send today's edition of this report?"
 */
function shouldRunScheduleWithStatus(rule: any, nowIST: Date): { shouldRun: boolean; reason: string } {
  const config = rule.schedule_config || {};
  const [hour, minute] = (config.time || '21:00').split(':').map(Number);
  
  // Current time in IST (passed from handler)
  const currentHour = nowIST.getUTCHours();
  const currentMinute = nowIST.getUTCMinutes();
  
  // 1. Time Check: Has the scheduled time been reached yet?
  if (currentHour < hour || (currentHour === hour && currentMinute < minute)) {
    return { shouldRun: false, reason: `Time ${config.time} not reached yet (current: ${currentHour}:${currentMinute} IST)` };
  }

  // 2. Frequency Check
  const freq = config.frequency || 'daily';
  const dayOfWeek = nowIST.getUTCDay(); // 0-6 (Sun-Sat)
  const dayOfMonth = nowIST.getUTCDate();

  if (freq === 'weekly' && config.dayOfWeek !== undefined && config.dayOfWeek !== dayOfWeek) {
    return { shouldRun: false, reason: `Wrong day of week (expected ${config.dayOfWeek}, got ${dayOfWeek})` };
  }
  if (freq === 'monthly' && config.dayOfMonth !== undefined && config.dayOfMonth !== dayOfMonth) {
    return { shouldRun: false, reason: `Wrong day of month (expected ${config.dayOfMonth}, got ${dayOfMonth})` };
  }

  return { shouldRun: true, reason: 'Scheduled time reached' };
}

async function resolveRecipients(supabase: any, rule: any): Promise<string[]> {
  if (rule.recipient_type === 'custom_emails') return rule.recipient_emails || [];
  if (rule.recipient_type === 'role') {
    const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []).eq('is_active', true);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  if (rule.recipient_type === 'users') {
    const { data: users } = await supabase.from('users').select('email').in('id', rule.recipient_user_ids || []);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }
  return [];
}

async function generateDailyAttendanceReport(supabase: any, nowIST: Date, istOffset: number): Promise<Record<string, any>> {
  const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - istOffset));
  const todayStr = format(nowIST, 'yyyy-MM-dd');

  // 1. Fetch settings and all active business users
  const { data: settingsData } = await supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single();
  const configStartTime = settingsData?.attendance_settings?.office?.fixedOfficeHours?.checkInTime || '09:30';
  
  const { data: allUsersRaw } = await supabase.from('users')
    .select('id, name, employee_id, role:roles(display_name)')
    .eq('is_active', true)
    .order('name');

  const filteredUsers = (allUsersRaw || []).filter((u: any) => {
    const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
    return roleName.toLowerCase() !== 'management';
  });
  const activeStaffIds = new Set(filteredUsers.map((u: any) => u.id));

  // 2. Fetch events (Today)
  const { data: todayEventsRaw, error: todayErr } = await supabase.from('attendance_events')
    .select('user_id, type, timestamp')
    .gte('timestamp', startOfTodayUTC.toISOString())
    .order('timestamp', { ascending: true });

  if (todayErr) console.error('Error fetching today events:', todayErr);
  const todayEvents = (todayEventsRaw || []).filter((e: any) => activeStaffIds.has(e.user_id));

  // Fetch only user IDs for 10-day lookback to calculate inactivity (saves memory/time)
  const tenDaysAgoUTC = new Date(startOfTodayUTC.getTime() - (9 * 24 * 60 * 60 * 1000));
  const { data: tenDayIdsRes } = await supabase.from('attendance_events')
    .select('user_id')
    .gte('timestamp', tenDaysAgoUTC.toISOString());
  
  const recentlyActiveUserIds = new Set((tenDayIdsRes || []).map((e: any) => e.user_id));

  // 3. Fetch today's approved leaves
  const { data: leaves } = await supabase.from('leave_requests')
    .select('user_id')
    .eq('status', 'approved')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr);

  const onLeaveUserIds = new Set((leaves || []).map((l: any) => l.user_id));

  // 4. Calculations
  const userFirstPunches: Record<string, string> = {};
  const presentUserIds = new Set<string>();
  todayEvents.forEach((e: any) => {
    presentUserIds.add(e.user_id);
    if (e.type === 'punch-in' && (!userFirstPunches[e.user_id] || new Date(e.timestamp) < new Date(userFirstPunches[e.user_id]))) {
      userFirstPunches[e.user_id] = e.timestamp;
    }
  });

  let lateCount = 0;
  Object.values(userFirstPunches).forEach(punchTs => {
    const punchIST = new Date(new Date(punchTs).getTime() + istOffset);
    if (format(punchIST, 'HH:mm') > configStartTime) lateCount++;
  });

  const totalPresent = presentUserIds.size;
  const inactiveCount = Math.max(0, filteredUsers.length - recentlyActiveUserIds.size);
  const onLeaveCount = Array.from(onLeaveUserIds).filter(id => activeStaffIds.has(id)).length;
  const totalAbsent = Math.max(0, filteredUsers.length - totalPresent - onLeaveCount - inactiveCount);
  let tableHtml = '';
  filteredUsers.forEach((user: any, i: number) => {
    let department = (Array.isArray(user.role) ? user.role[0]?.display_name : user.role?.display_name) || 'Staff';
    if (department.includes('_')) {
        department = department.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    let statusText = 'Present';
    let statusColor = '#16a34a'; // green
    let punchInTime = '—';
    let punchOutTime = '—';
    let workHours = '—';
    
    if (presentUserIds.has(user.id)) {
      const punchInTs = userFirstPunches[user.id];
      const punchInDate = punchInTs ? new Date(new Date(punchInTs).getTime() + istOffset) : null;
      
      const lastPunchOut = todayEvents.filter((e: any) => e.user_id === user.id && e.type === 'punch-out').pop();
      const punchOutDate = lastPunchOut ? new Date(new Date(lastPunchOut.timestamp).getTime() + istOffset) : null;

      if (punchInDate) {
         punchInTime = format(punchInDate, 'hh:mm a');
         if (format(punchInDate, 'HH:mm') > configStartTime) {
             statusText = 'Late';
             statusColor = '#d97706'; // amber
         }
      }
      if (punchOutDate) {
         punchOutTime = format(punchOutDate, 'hh:mm a');
      }
      
      if (punchInDate && punchOutDate) {
          const diffMs = punchOutDate.getTime() - punchInDate.getTime();
          if (diffMs > 0) {
             const hrs = Math.floor(diffMs / (1000 * 60 * 60));
             const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
             workHours = `${hrs}h ${mins}m`;
          }
      }
    } else if (onLeaveUserIds.has(user.id)) {
      statusText = 'On Leave';
      statusColor = '#2563eb'; // blue
    } else if (recentlyActiveUserIds.has(user.id)) {
      statusText = 'Absent';
      statusColor = '#dc2626'; // red
    } else {
      statusText = 'Inactive';
      statusColor = '#9ca3af'; // gray
    }
    
    tableHtml += `
        <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${i + 1}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 500; color: #111827;">${user.name || '—'}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px; color: #4b5563;">${department}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px; color: #4b5563;">${punchInTime}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px; color: #4b5563;">${punchOutTime}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px; color: #4b5563;">${workHours}</td>
          <td style="border: 1px solid #e5e7eb; padding: 8px; color: ${statusColor}; font-weight: 600;">${statusText}</td>
        </tr>`;
  });

  if (!tableHtml) {
      tableHtml = `<tr><td colspan="7" style="border: 1px solid #e5e7eb; padding: 12px; text-align: center; color: #6b7280; font-style: italic;">No attendance data found for today.</td></tr>`;
  }

  const dateFormatted = format(nowIST, 'EEEE, MMMM do, yyyy');
  const generatedTime = format(nowIST, 'hh:mm a');
  
  const totalEmployees = filteredUsers.length;
  const attendancePercentage = totalEmployees > 0 ? Math.round((totalPresent / totalEmployees) * 100).toString() : '0';

  return {
    date: dateFormatted,
    generatedTime,
    totalEmployees: String(totalEmployees),
    totalPresent: String(totalPresent),
    totalAbsent: String(totalAbsent),
    lateCount: String(lateCount),
    attendancePercentage,
    onLeaveCount: String(onLeaveCount),
    inactiveCount: String(inactiveCount),
    table: tableHtml,
    subject: `Daily Attendance Report`,
    message: `Attendance: ${totalPresent} Present, ${totalAbsent} Absent, ${onLeaveCount} On Leave, ${inactiveCount} Inactive.`,
  };
}

// ═══ Monthly Attendance Report Generator ══════════════════════════════════

async function generateMonthlyAttendanceReport(
  supabase: any,
  nowIST: Date,
  istOffset: number
): Promise<Record<string, string>> {
  const year = nowIST.getUTCFullYear();
  const month = nowIST.getUTCMonth(); // Current month (0-11)
  
  // Start and End of month in IST
  const startOfMonthIST = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const endOfMonthIST = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  
  const startOfRangeUTC = new Date(startOfMonthIST.getTime() - istOffset);
  const endOfRangeUTC = new Date(endOfMonthIST.getTime() - istOffset);

  // Get active users
  const { data: users } = await supabase.from('users').select('id, name, employee_id').eq('is_active', true).order('name');
  
  // Get all attendance for the month
  const { data: events } = await supabase
    .from('attendance_events')
    .select('user_id, type, timestamp')
    .gte('timestamp', startOfRangeUTC.toISOString())
    .lte('timestamp', endOfRangeUTC.toISOString())
    .order('timestamp', { ascending: true });

  const monthName = format(nowIST, 'MMMM');
  const dateFormatted = format(nowIST, 'MMMM do, yyyy');

  // Group events by user and by day
  const userStats = new Map<string, { presentDays: number, lateCount: number, absentDays: number }>();
  
  // Simple logic: a user is "Present" if they have at least one event on a given day
  const userDailyPresence = new Map<string, Set<string>>();
  
  (events || []).forEach((e: any) => {
    const eventIST = new Date(new Date(e.timestamp).getTime() + istOffset);
    const dayStr = eventIST.toISOString().split('T')[0];
    
    if (!userDailyPresence.has(e.user_id)) userDailyPresence.set(e.user_id, new Set());
    userDailyPresence.get(e.user_id)!.add(dayStr);
  });

  // Calculate stats
  const totalDaysInMonthSoFar = nowIST.getUTCDate();
  let totalWorkingDays = 0;
  // Count only weekdays (Mon-Sat, assuming Sun off)
  for (let d = 1; d <= totalDaysInMonthSoFar; d++) {
    const day = new Date(Date.UTC(year, month, d));
    if (day.getUTCDay() !== 0) totalWorkingDays++;
  }

  let table = `
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #e5e7eb; color: #374151;">Employee Name</th>
          <th style="text-align: center; padding: 10px 12px; border-bottom: 2px solid #e5e7eb; color: #374151;">Days Present</th>
          <th style="text-align: center; padding: 10px 12px; border-bottom: 2px solid #e5e7eb; color: #374151;">Days Absent</th>
          <th style="text-align: right; padding: 10px 12px; border-bottom: 2px solid #e5e7eb; color: #374151;">Attendance %</th>
        </tr>
      </thead>
      <tbody>`;

  let sumAttendance = 0;
  let totalAbsences = 0;

  (users || []).forEach((user: any, i: number) => {
    const daysPresent = userDailyPresence.get(user.id)?.size || 0;
    const daysAbsent = Math.max(0, totalWorkingDays - daysPresent);
    const attendancePct = totalWorkingDays > 0 ? Math.round((daysPresent / totalWorkingDays) * 100) : 0;
    
    sumAttendance += attendancePct;
    totalAbsences += daysAbsent;

    const bgColor = i % 2 === 0 ? '#ffffff' : '#f9fafb';
    const statusColor = attendancePct >= 90 ? '#059669' : attendancePct >= 75 ? '#d97706' : '#dc2626';

    table += `
        <tr style="background: ${bgColor};">
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-weight: 600;">${user.name} <span style="font-weight: 400; color: #6b7280; font-size: 10px;">(${user.employee_id || 'N/A'})</span></td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: center;">${daysPresent}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: center; color: ${daysAbsent > 0 ? '#dc2626' : '#6b7280'};">${daysAbsent}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 700; color: ${statusColor};">${attendancePct}%</td>
        </tr>`;
  });

  table += `</tbody></table>`;

  const avgAttendance = users && users.length > 0 ? Math.round(sumAttendance / users.length) : 0;

  return {
    month: monthName,
    year: String(year),
    date: dateFormatted,
    totalWorkingDays: String(totalWorkingDays),
    avgAttendance: String(avgAttendance),
    totalLate: '—', // Would need deeper event analysis for precise late counts
    totalAbsences: String(totalAbsences),
    table
  };
}

// ═══ Document Expiry Report Generator ════════════════════════════════════

async function generateDocumentExpiryReport(supabase: any, nowIST: Date): Promise<Record<string, string>> {
  // Query companies and societies for expiry fields
  const [compRes, socRes] = await Promise.all([
    supabase.from('companies').select('id, name, psara_valid_till, pan_card_path, trade_license_path'),
    supabase.from('societies').select('id, name, psara_valid_till, pan_card_path')
  ]);

  const allEntities = [...(compRes.data || []), ...(socRes.data || [])];
  const expiringSoon = [];
  
  const now = new Date(nowIST);
  const thirtyDaysOut = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  for (const entity of allEntities) {
    if (entity.psara_valid_till) {
      const expiry = new Date(entity.psara_valid_till);
      if (expiry <= thirtyDaysOut && expiry >= now) {
        const days = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        expiringSoon.push({
          name: entity.name,
          doc: 'PSARA License',
          expiry: format(expiry, 'dd/MM/yyyy'),
          days
        });
      }
    }
  }

  if (expiringSoon.length === 0) {
    return {
      date: format(nowIST, 'dd/MM/yyyy'),
      table: '<p style="color: #059669; font-weight: 600;">✅ No documents expiring in the next 30 days.</p>',
      entityName: 'N/A',
      documentType: 'N/A',
      expiryDate: 'N/A',
      daysRemaining: '0'
    };
  }

  let table = `
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <thead style="background: #fffbeb;">
        <tr>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #fde68a;">Entity</th>
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #fde68a;">Document</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #fde68a;">Expiry</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #fde68a;">Urgency</th>
        </tr>
      </thead>
      <tbody>`;

  expiringSoon.forEach((item, i) => {
    const color = item.days <= 7 ? '#dc2626' : item.days <= 15 ? '#ea580c' : '#d97706';
    table += `
      <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${item.name}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${item.doc}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.expiry}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 800; color: ${color};">${item.days} days</td>
      </tr>`;
  });

  table += `</tbody></table>`;

  return {
    date: format(nowIST, 'dd/MM/yyyy'),
    table,
    entityName: expiringSoon[0].name,
    documentType: expiringSoon[0].doc,
    expiryDate: expiringSoon[0].expiry,
    daysRemaining: String(expiringSoon[0].days)
  };
}

// ═══ Pending Approvals Report Generator ══════════════════════════════════

async function generatePendingApprovalsReport(supabase: any): Promise<Record<string, string>> {
  // Check common tables for pending status with correct Supabase v2 syntax
  const [onboardRes, leavesRes, salaryRes] = await Promise.all([
    supabase.from('onboarding_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('salary_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  ]);
  
  const onboard = onboardRes.count || 0;
  const leaves = leavesRes.count || 0;
  const salary = salaryRes.count || 0;
  const total = onboard + leaves + salary;

  if (total === 0) return { subject: 'No pending approvals', message: 'All clear!' };

  let table = `
    <div style="padding: 20px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb;">
      <h3 style="margin-top: 0; color: #374151;">Pending Review Summary</h3>
      <ul style="list-style: none; padding: 0; margin: 0;">
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between;">
          <span>New Onboardings</span>
          <strong style="color: #d97706;">${onboard}</strong>
        </li>
        <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between;">
          <span>Leave Requests</span>
          <strong style="color: #d97706;">${leaves}</strong>
        </li>
        <li style="padding: 10px 0; display: flex; justify-content: space-between;">
          <span>Salary Adjustments</span>
          <strong style="color: #d97706;">${salary}</strong>
        </li>
      </ul>
    </div>`;

  return {
    subject: `Approval Reminder: ${total} items pending`,
    message: `You have ${total} requests waiting for your review in the management dashboard.`,
    table
  };
}
