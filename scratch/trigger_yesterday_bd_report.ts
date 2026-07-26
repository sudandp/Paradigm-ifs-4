import { createClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

async function run() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  const now = new Date();
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  const yesterdayIST = subDays(nowIST, 1);
  
  const startOfYesterdayUTC = new Date(startOfDay(yesterdayIST).getTime() - IST_OFFSET);
  const endOfYesterdayUTC = new Date(endOfDay(yesterdayIST).getTime() - IST_OFFSET);

  const reportDateFormatted = format(yesterdayIST, 'EEEE, MMMM do, yyyy');

  console.log('Sending BD Daily Report for YESTERDAY:', reportDateFormatted);

  const { data: usersRes } = await supabase.from('users').select('id, name, role:roles(display_name)').eq('is_blocked', false);
  const bdUsers = (usersRes || []).filter((u: any) => {
    const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
    return roleName.toLowerCase() === 'business developer' || roleName.toLowerCase() === 'business_developer';
  });

  if (bdUsers.length === 0) {
      console.log('No BD users found');
      return;
  }
  
  console.log('BD Users found:', bdUsers.map(u => u.name).join(', '));

  const [eventsRes, leadsRes, callsRes] = await Promise.all([
    supabase.from('attendance_events').select('user_id, type, timestamp, latitude, longitude, travel_distance').gte('timestamp', startOfYesterdayUTC.toISOString()).lte('timestamp', endOfYesterdayUTC.toISOString()).order('timestamp', { ascending: true }),
    supabase.from('crm_leads').select('id, created_by, assigned_to, company_name, contact_person, status, created_at').gte('created_at', startOfYesterdayUTC.toISOString()).lte('created_at', endOfYesterdayUTC.toISOString()),
    supabase.from('crm_followups').select('created_by, type, lead_id, created_at').gte('created_at', startOfYesterdayUTC.toISOString()).lte('created_at', endOfYesterdayUTC.toISOString())
  ]);

  const events = eventsRes.data || [];
  const leads = leadsRes.data || [];
  const calls = callsRes.data || [];

  const { data: allActiveLeads } = await supabase.from('crm_leads')
    .select('assigned_to, created_by, status')
    .neq('status', 'Won')
    .neq('status', 'Lost');

  const reports: any[] = [];

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

    let new_leads_table = `<div style="padding:16px;text-align:center;color:#64748b;font-style:italic;">No new leads added on this date.</div>`;
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
      date: reportDateFormatted,
      bd_name: bd.name || 'BD',
      bdName: bd.name || 'BD',
      report_date: reportDateFormatted,
      reportDate: reportDateFormatted,
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

  // Get email schedule rule and settings
  const { data: scheduleRules } = await supabase.from('email_schedule_rules').select('*');
  const rule = (scheduleRules || []).find((r: any) => r.report_type === 'crm_bd_daily' || r.report_type === 'bd_daily' || r.name.toLowerCase().includes('bd')) || {
    name: 'BD Report',
    template_id: '50d7d5f8-e777-4a3c-89d1-5f7d29427d5b',
    recipient_emails: ['sudhan@paradigmfms.com', 'sudandpineee@gmail.com']
  };
  console.log('Found Schedule Rule:', rule.name, 'Template ID:', rule.template_id);

  const { data: tmpl } = await supabase.from('email_templates').select('*').eq('id', rule.template_id).single();

  const { data: settings } = await supabase.from('settings').select('email_config').eq('id', 'singleton').single();
  const emailConfig = settings?.email_config || {};

  const transporter = nodemailer.createTransport({
    host: emailConfig.host || 'smtp.gmail.com',
    port: Number(emailConfig.port) || 587,
    secure: emailConfig.secure || false,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const render = (text: string, data: Record<string, string>) => {
    if (!text) return '';
    return text.replace(/\{([\w]+)\}/gi, (match, key) => {
      const cleanKey = key.toLowerCase().replace(/[_-]/g, '');
      const dataKey = Object.keys(data || {}).find(k => k.toLowerCase().replace(/[_-]/g, '') === cleanKey);
      if (dataKey && data[dataKey] !== undefined && data[dataKey] !== null) {
          return data[dataKey];
      }
      return match;
    });
  };

  const recipients = rule.recipients || ['sudhan@paradigmfms.com'];
  console.log('Target Email Recipients:', recipients);

  for (const reportItem of reports) {
      let subject = tmpl?.subject_template || 'BD Daily Activity Report — {bd_name} — {report_date}';
      let html = tmpl?.body_template || '<p>BD Report for {bd_name}</p>';

      let greetingMessage = `Dear Management,<br/><br/>Daily Activity Report for <strong>{bd_name}</strong> for <strong>{report_date}</strong>.`;
      greetingMessage = render(greetingMessage, reportItem);
      reportItem.greetingMessage = greetingMessage;

      subject = evaluateConditionals(subject, reportItem);
      html = evaluateConditionals(html, reportItem);

      subject = render(subject, reportItem);
      html = render(html, reportItem);

      const mailOptions = {
          from: `"${emailConfig.from_name || 'Paradigm Fms'}" <${emailConfig.user}>`,
          to: recipients.join(', '),
          subject: subject,
          html: html
      };

      const result = await transporter.sendMail(mailOptions);
      console.log(`✅ Yesterday's Email delivered successfully for BD: ${reportItem.bd_name} MessageId: ${result.messageId}`);
  }
}

run().catch(console.error);
