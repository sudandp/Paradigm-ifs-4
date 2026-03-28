import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Security Check (Internal API Key)
  const apiKey = req.headers['x-api-key'];
  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey && apiKey !== internalKey) {
    console.warn('[process-email-schedules] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[process-email-schedules] Starting...');

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

    // 2. Get all active schedule rules
    const { data: rules, error: rulesErr } = await supabase
      .from('email_schedule_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesErr) throw rulesErr;
    if (!rules || rules.length === 0) {
      return res.status(200).json({ message: 'No active email schedules', processed: 0 });
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
    const todayStr = nowIST.toISOString().split('T')[0]; // YYYY-MM-DD in IST

    let totalSent = 0;

    for (const rule of rules) {
      console.log(`[Schedule] Processing: "${rule.name}" (trigger: ${rule.trigger_type})`);

      // Check if should run now (for scheduled type)
      if (rule.trigger_type === 'scheduled') {
        const shouldRun = shouldRunSchedule(rule, nowIST);
        if (!shouldRun) {
          console.log(`  → Skipped (not time yet)`);
          continue;
        }
        // Check if already sent today
        if (rule.last_sent_at) {
          const lastSentIST = new Date(new Date(rule.last_sent_at).getTime() + istOffset);
          const lastSentDate = lastSentIST.toISOString().split('T')[0];
          if (lastSentDate === todayStr && rule.schedule_config?.frequency === 'daily') {
            console.log(`  → Skipped (already sent today)`);
            continue;
          }
        }
      }

      // Get template
      const template = templateMap.get(rule.template_id);

      // Generate report data
      let reportData: Record<string, string> = {
        date: nowIST.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        subject: rule.name,
        message: '',
      };

      if (rule.report_type === 'attendance_daily') {
        reportData = await generateDailyAttendanceReport(supabase, nowIST, istOffset, todayStr);
      } else if (rule.report_type === 'attendance_monthly') {
        reportData = await generateMonthlyAttendanceReport(supabase, nowIST, istOffset);
      } else if (rule.report_type === 'document_expiry') {
        reportData = await generateDocumentExpiryReport(supabase, nowIST);
      } else if (rule.report_type === 'pending_approvals') {
        reportData = await generatePendingApprovalsReport(supabase);
      }

      // Render template
      let subject = template?.subject_template || rule.name;
      let html = template?.body_template || `<div><h2>${rule.name}</h2><p>Automated report</p></div>`;

      for (const [key, value] of Object.entries(reportData)) {
        subject = subject.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        html = html.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
      }

      // Resolve recipients
      const emails = await resolveRecipients(supabase, rule);
      if (emails.length === 0) {
        console.log(`  → No recipients found`);
        continue;
      }

      console.log(`  → Sending to ${emails.length} recipients: ${emails.join(', ')}`);

      // Send email
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: emails.join(', '),
          replyTo: emailConfig.reply_to || emailConfig.from_email || emailConfig.user,
          subject,
          html,
        });

        // Log successes
        for (const email of emails) {
          await supabase.from('email_logs').insert({
            rule_id: rule.id,
            template_id: rule.template_id,
            recipient_email: email,
            subject,
            status: 'sent',
          });
        }

        // Update last_sent_at
        await supabase.from('email_schedule_rules')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', rule.id);

        totalSent += emails.length;
        console.log(`  ✅ Sent successfully`);

      } catch (mailErr: any) {
        console.error(`  ❌ Failed:`, mailErr.message);
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

    return res.status(200).json({ success: true, processed: totalSent, timestamp: now.toISOString() });

  } catch (error: any) {
    console.error('[process-email-schedules] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ═══ Schedule Timing Check ═══════════════════════════════════════════════

function shouldRunSchedule(rule: any, nowIST: Date): boolean {
  const config = rule.schedule_config || {};
  const [hour, minute] = (config.time || '21:00').split(':').map(Number);

  const currentHour = nowIST.getUTCHours();
  const currentMinute = nowIST.getUTCMinutes();

  // Check if we're within the scheduled hour (allow 30-min window)
  if (currentHour < hour || (currentHour === hour && currentMinute < minute)) return false;
  if (currentHour > hour + 1) return false; // Too late (more than 1 hour past)

  // Check frequency
  const freq = config.frequency || 'daily';
  const dayOfWeek = nowIST.getUTCDay();
  const dayOfMonth = nowIST.getUTCDate();

  if (freq === 'weekly' && config.dayOfWeek !== undefined && config.dayOfWeek !== dayOfWeek) return false;
  if (freq === 'monthly' && config.dayOfMonth !== undefined && config.dayOfMonth !== dayOfMonth) return false;

  return true;
}

// ═══ Recipient Resolution ════════════════════════════════════════════════

async function resolveRecipients(supabase: any, rule: any): Promise<string[]> {
  const emails: string[] = [];

  if (rule.recipient_type === 'custom_emails') {
    return rule.recipient_emails || [];
  }

  if (rule.recipient_type === 'role') {
    const { data: users } = await supabase
      .from('users')
      .select('email')
      .in('role_id', rule.recipient_roles || [])
      .eq('is_active', true);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }

  if (rule.recipient_type === 'users') {
    const { data: users } = await supabase
      .from('users')
      .select('email')
      .in('id', rule.recipient_user_ids || []);
    return (users || []).map((u: any) => u.email).filter(Boolean);
  }

  return emails;
}

// ═══ Daily Attendance Report Generator ═══════════════════════════════════

async function generateDailyAttendanceReport(
  supabase: any,
  nowIST: Date,
  istOffset: number,
  todayStr: string
): Promise<Record<string, string>> {
  // Calculate IST midnight → UTC for DB query
  const midnightIST = new Date(nowIST);
  midnightIST.setUTCHours(0, 0, 0, 0);
  const startOfTodayUTC = new Date(midnightIST.getTime() - istOffset);

  // Get all active users
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, email, role_id, employee_id')
    .eq('is_active', true)
    .order('name');

  // Get today's attendance events
  const { data: events } = await supabase
    .from('attendance_events')
    .select('user_id, type, timestamp, location_name')
    .gt('timestamp', startOfTodayUTC.toISOString())
    .order('timestamp', { ascending: true });

  // Process: find who punched in today
  const userEventsMap = new Map<string, any[]>();
  (events || []).forEach((e: any) => {
    if (!userEventsMap.has(e.user_id)) userEventsMap.set(e.user_id, []);
    userEventsMap.get(e.user_id)!.push(e);
  });

  const presentUsers: any[] = [];
  const absentUsers: any[] = [];
  let lateCount = 0;

  (allUsers || []).forEach((user: any) => {
    const userEvents = userEventsMap.get(user.id);
    if (userEvents && userEvents.length > 0) {
      const firstPunchIn = userEvents.find((e: any) => e.type === 'punch-in');
      const lastEvent = userEvents[userEvents.length - 1];
      
      let punchInTime = '—';
      let isLate = false;
      if (firstPunchIn) {
        const punchIST = new Date(new Date(firstPunchIn.timestamp).getTime() + istOffset);
        punchInTime = punchIST.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        // Consider late if after 9:30 AM
        if (punchIST.getUTCHours() > 9 || (punchIST.getUTCHours() === 9 && punchIST.getUTCMinutes() > 30)) {
          isLate = true;
          lateCount++;
        }
      }

      let punchOutTime = '—';
      const lastPunchOut = [...userEvents].reverse().find((e: any) => e.type === 'punch-out');
      if (lastPunchOut) {
        const outIST = new Date(new Date(lastPunchOut.timestamp).getTime() + istOffset);
        punchOutTime = outIST.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      }

      presentUsers.push({
        name: user.name,
        employeeId: user.employee_id || '—',
        punchIn: punchInTime,
        punchOut: punchOutTime,
        location: firstPunchIn?.location_name || '—',
        isLate,
      });
    } else {
      absentUsers.push({
        name: user.name,
        employeeId: user.employee_id || '—',
      });
    }
  });

  const totalPresent = presentUsers.length;
  const totalAbsent = absentUsers.length;

  // Build HTML table
  const dateFormatted = nowIST.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let table = `
    <h3 style="color: #059669; margin: 0 0 12px 0; font-size: 15px;">✅ Present Staff (${totalPresent})</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
      <thead>
        <tr style="background: #f0fdf4;">
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #d1fae5; color: #065f46; font-weight: 700;">#</th>
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #d1fae5; color: #065f46; font-weight: 700;">Name</th>
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #d1fae5; color: #065f46; font-weight: 700;">ID</th>
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #d1fae5; color: #065f46; font-weight: 700;">Punch In</th>
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #d1fae5; color: #065f46; font-weight: 700;">Punch Out</th>
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #d1fae5; color: #065f46; font-weight: 700;">Location</th>
        </tr>
      </thead>
      <tbody>`;

  presentUsers.forEach((u, i) => {
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f9fafb';
    const lateTag = u.isLate ? ' <span style="color: #dc2626; font-size: 10px; font-weight: 700;">⚠ LATE</span>' : '';
    table += `
        <tr style="background: ${bgColor};">
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">${i + 1}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-weight: 600; color: #111827;">${u.name}${lateTag}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">${u.employeeId}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #059669; font-weight: 600;">${u.punchIn}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">${u.punchOut}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-size: 11px;">${u.location}</td>
        </tr>`;
  });

  table += `</tbody></table>`;

  // Absent staff section
  if (absentUsers.length > 0) {
    table += `
    <h3 style="color: #dc2626; margin: 0 0 12px 0; font-size: 15px;">❌ Absent Staff (${totalAbsent})</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr style="background: #fef2f2;">
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #fecaca; color: #991b1b; font-weight: 700;">#</th>
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #fecaca; color: #991b1b; font-weight: 700;">Name</th>
          <th style="text-align: left; padding: 10px 12px; border-bottom: 2px solid #fecaca; color: #991b1b; font-weight: 700;">Employee ID</th>
        </tr>
      </thead>
      <tbody>`;

    absentUsers.forEach((u, i) => {
      const bgColor = i % 2 === 0 ? '#ffffff' : '#fef2f2';
      table += `
        <tr style="background: ${bgColor};">
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">${i + 1}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-weight: 600; color: #111827;">${u.name}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #f3f4f6; color: #6b7280;">${u.employeeId}</td>
        </tr>`;
    });

    table += `</tbody></table>`;
  }

  return {
    date: dateFormatted,
    totalPresent: String(totalPresent),
    totalAbsent: String(totalAbsent),
    lateCount: String(lateCount),
    table,
    subject: `Daily Attendance Report`,
    message: `Today's attendance: ${totalPresent} present, ${totalAbsent} absent, ${lateCount} late arrivals.`,
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

  const monthName = nowIST.toLocaleString('en-IN', { month: 'long' });
  const dateFormatted = nowIST.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

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
          expiry: expiry.toLocaleDateString('en-IN'),
          days
        });
      }
    }
  }

  if (expiringSoon.length === 0) {
    return {
      date: nowIST.toLocaleDateString('en-IN'),
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
    date: nowIST.toLocaleDateString('en-IN'),
    table,
    entityName: expiringSoon[0].name,
    documentType: expiringSoon[0].doc,
    expiryDate: expiringSoon[0].expiry,
    daysRemaining: String(expiringSoon[0].days)
  };
}

// ═══ Pending Approvals Report Generator ══════════════════════════════════

async function generatePendingApprovalsReport(supabase: any): Promise<Record<string, string>> {
  // Check common tables for pending status
  const [onboardRes, leavesRes, salaryRes] = await Promise.all([
    supabase.from('onboarding_submissions').select('count').eq('status', 'pending'),
    supabase.from('leave_requests').select('count').eq('status', 'pending'),
    supabase.from('salary_requests').select('count').eq('status', 'pending')
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
