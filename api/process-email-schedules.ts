import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as nodemailer from 'nodemailer';
import { format, startOfDay, isSameDay } from 'date-fns';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function getISTDateString(date: Date): string {
  const istDate = new Date(date.getTime() + IST_OFFSET);
  return istDate.toISOString().substring(0, 10);
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
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
      year: format(nowIST, 'yyyy'),
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
    const targetDate = new Date(nowIST.getFullYear(), nowIST.getMonth() - 1, 1);
    const firstDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastDayOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    const monthStr = format(targetDate, 'MMMM yyyy');
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
  document_expiry: async (s:any,now:any) => { return {date:format(now,'yyyy-MM-dd')}; },
  crm_bd_daily: async (supabase: SupabaseClient, nowIST: Date) => {
    const todayStr = getISTDateString(nowIST);
    const startOfTodayUTC = startOfDay(new Date(nowIST.getTime() - IST_OFFSET));

    // Fetch BD users
    const { data: usersRes } = await supabase.from('users').select('id, name, role:roles(display_name)').eq('is_blocked', false);
    const bdUsers = (usersRes || []).filter((u: any) => {
      const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
      return roleName.toLowerCase() === 'business developer' || roleName.toLowerCase() === 'business_developer';
    });

    if (bdUsers.length === 0) return [];

    // Fetch related data for today
    const [eventsRes, leadsRes, callsRes] = await Promise.all([
      supabase.from('attendance_events').select('user_id, type, timestamp, latitude, longitude, travel_distance').gte('timestamp', startOfTodayUTC.toISOString()).order('timestamp', { ascending: true }),
      supabase.from('crm_leads').select('id, created_by, assigned_to, company_name, contact_person, status, created_at').gte('created_at', startOfTodayUTC.toISOString()),
      supabase.from('crm_followups').select('created_by, type, lead_id, created_at').gte('created_at', startOfTodayUTC.toISOString())
    ]);

    const events = eventsRes.data || [];
    const leads = leadsRes.data || [];
    const calls = callsRes.data || [];

    // Fetch ALL active leads for pipeline snapshot (not just today's)
    const { data: allActiveLeads } = await supabase.from('crm_leads')
      .select('assigned_to, created_by, status')
      .neq('status', 'Won')
      .neq('status', 'Lost');

    const reports = [];

    for (const bd of bdUsers) {
      // 1. Attendance Data
      const bdEvents = [...events.filter((e: any) => e.user_id === bd.id)].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      let attendance_status = bdEvents.length > 0 ? 'Present' : 'Absent';
      let check_in_time = 'N/A';
      let check_out_time = 'N/A';
      let working_hours = '0h 0m';
      
      const punchesIn = bdEvents.filter((e: any) => e.type === 'punch-in' || e.type === 'site-in' || e.type === 'site-ot-in');
      const punchesOut = bdEvents.filter((e: any) => e.type === 'punch-out' || e.type === 'site-out' || e.type === 'site-ot-out');
      
      if (punchesIn.length > 0) {
        check_in_time = new Date(punchesIn[0].timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
      }
      if (punchesOut.length > 0) {
        check_out_time = new Date(punchesOut[punchesOut.length - 1].timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
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

      // 2. Activity Summary
      const newLeadsToday = leads.filter((l: any) => l.created_by === bd.id || l.assigned_to === bd.id);
      const newLeadsIds = new Set(newLeadsToday.map((l: any) => l.id));
      
      const prospect_calls = calls.filter((c: any) => c.created_by === bd.id && c.type === 'Call' && newLeadsIds.has(c.lead_id)).length;
      const followup_calls = calls.filter((c: any) => c.created_by === bd.id && c.type === 'Call' && !newLeadsIds.has(c.lead_id)).length;
      
      const new_leads_count = newLeadsToday.length;
      const sites_count = calls.filter((c: any) => c.created_by === bd.id && c.type === 'Site Visit').length;
      const sites_visited = 'Not applicable (Automated Schedule)';
      let kms_travelled = calculateDailyTravelKm(bdEvents).toString();

      // 3. New Leads Added HTML
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

      // 4. Metrics Table HTML
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

      // 5. Pipeline Snapshot
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
        bd_name: bd.name || 'BD',
        report_date: format(nowIST, 'dd MMM yyyy'),
        attendance_status,
        check_in_time,
        check_out_time,
        working_hours,
        kms_travelled,
        prospect_calls: String(prospect_calls),
        followup_calls: String(followup_calls),
        new_leads_count: String(new_leads_count),
        sites_count: String(sites_count),
        sites_visited,
        new_leads_table,
        metrics_table,
        pipeline_snapshot
      });
    }

    return reports;
  }
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
// [SECURITY FIX] Removed fallback to VITE_SUPABASE_ANON_KEY (matches send-email.ts fix C7)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
    tls: { rejectUnauthorized: false }
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
      const { data: users } = await supabase.from('users').select('email').in('role_id', rule.recipient_roles || []).eq('is_blocked', false);
      emails = (users || []).map((u: any) => u.email).filter(Boolean);
    } else if (rule.recipient_type === 'users') {
      const { data: users } = await supabase.from('users').select('email').in('id', rule.recipient_user_ids || []).eq('is_blocked', false);
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
    const reportDataList = Array.isArray(reportData) ? reportData : [reportData];

    for (const dataItem of reportDataList) {
      let greetingMessage = `Here is your automated status update.`;
      
      if (rule.report_type === 'attendance_monthly') {
          greetingMessage = `Dear Management,<br/><br/>This is the consolidated attendance summary for the period of <strong>{date}</strong>. It covers overall employee presence across all <strong>{totalEmployees}</strong> active members of the staff.<br/><br/>Please review the detailed monthly attendance grid below for any discrepancies.`;
      }

      if (template?.variables) {
        const customVar = (template.variables as any[]).find(v => v.key === '_custom_message' || v.key === 'customMessage');
        if (customVar && customVar.description && customVar.description.trim()) {
          let evaluatedMsg = evaluateConditionals(customVar.description, dataItem || {});
          greetingMessage = evaluatedMsg.replace(/\n/g, '<br/>');
        }
      }

      const render = (text: string, data: any) => (text || '').replace(/\{(\w+)\}/g, (match, key) => {
        const cleanKey = key.toLowerCase().replace(/[_-]/g, '');
        const dataKey = Object.keys(data).find(k => k.toLowerCase().replace(/[_-]/g, '') === cleanKey);
        return dataKey ? (data as any)[dataKey] : match;
      });

      greetingMessage = render(greetingMessage, dataItem || {});

      dataItem.greetingMessage = greetingMessage;
      dataItem.customGreeting = greetingMessage;
      dataItem.greeting_message = greetingMessage;
      dataItem.custom_greeting = greetingMessage;
      dataItem.summary = greetingMessage;

      let subject = template?.subject_template || rule.name;
      let html = template?.body_template || `<h2>Report</h2>{table}`;

      subject = evaluateConditionals(subject, dataItem);
      html = evaluateConditionals(html, dataItem);

      subject = render(subject, dataItem);
      html = render(html, dataItem);

      try {
        await transporter.sendMail({
          from: `"${emailConfig.from_name || 'Paradigm FMS'}" <${emailConfig.from_email || emailConfig.user}>`,
          to: emails.join(', '),
          replyTo: emailConfig.reply_to || emailConfig.from_email,
          subject, html
        });
        await Promise.all([
          ...emails.map(email => supabase.from('email_logs').insert({ rule_id: rule.id, template_id: rule.template_id, recipient_email: email, subject, status: 'sent', metadata: { trigger_type: 'automatic' } }))
        ]);
        totalSent += emails.length;
      } catch (mailErr: any) {
        await Promise.all(emails.map(email => supabase.from('email_logs').insert({ rule_id: rule.id, recipient_email: email, subject, status: 'failed', error_message: mailErr.message, metadata: { trigger_type: 'automatic' } })));
      }
    }
    
    await supabase.from('email_schedule_rules').update({ last_sent_at: now.toISOString() }).eq('id', rule.id);
  }
  return { success: true, processed: totalSent };
}
