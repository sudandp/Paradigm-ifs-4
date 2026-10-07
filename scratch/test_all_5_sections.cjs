const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { format } = require('date-fns');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > -1) {
    const k = l.slice(0, idx).trim();
    let v = l.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY
);

function formatTimeIST(date, fallback = 'N/A') {
  if (!date) return fallback;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return fallback;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d).replace(/\u202f/g, ' ');
  } catch {
    return fallback;
  }
}

function calculateDailyTravelKm(events) {
  if (!events || events.length === 0) return 0;
  const sessions = [];
  let curSession = [];
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  sortedEvents.forEach(e => {
    if (e.type === 'punch-in') {
      if (curSession.length > 0) sessions.push(curSession);
      curSession = [e];
    } else {
      curSession.push(e);
    }
  });
  if (curSession.length > 0) sessions.push(curSession);

  let totalDailyKm = 0;
  sessions.forEach(sess => {
    const deviceValues = sess.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    let deviceDist = 0;
    if (deviceValues.length > 0) {
      const maxVal = Math.max(...deviceValues);
      const firstVal = Number(sess[0]?.travel_distance || 0);
      deviceDist = firstVal > 0 ? (maxVal - firstVal) : maxVal;
    }
    totalDailyKm += deviceDist;
  });
  return Number(totalDailyKm.toFixed(2));
}

function buildTemplate() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="background:#ffffff;font-family:'Inter',-apple-system,sans-serif;margin:0;padding:12px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:760px;margin:0 auto;table-layout:fixed;">

  <!-- HEADER -->
  <tr><td style="background:#ffffff;border-radius:12px 12px 0 0;padding:20px 24px;border-bottom:4px solid #16a34a;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" width="50%">
        <img src="https://app.paradigmfms.com/Paradigm-Logo-3-1024x157.png" alt="Paradigm" style="height:36px;display:block;">
        <div style="margin-top:8px;font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Business Development</div>
      </td>
      <td valign="top" align="right" width="50%">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;display:inline-block;text-align:left;">
          <div style="font-size:10px;color:#166534;text-transform:uppercase;font-weight:700;">Daily Activity Report</div>
          <div style="font-size:16px;color:#15803d;font-weight:800;margin-top:4px;">{report_date}</div>
          <div style="font-size:11px;color:#374151;margin-top:4px;">BD: <strong>{bd_name}</strong></div>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SECTION 1: ATTENDANCE & TIME -->
  <tr><td style="background:#ffffff;padding:20px 24px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">1. Attendance &amp; Time</div>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:4px 0;table-layout:fixed;"><tr>
      <td style="background:{status_bg};border:1px solid {status_border};border-radius:8px;padding:10px 4px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</div>
        <div style="font-size:13px;font-weight:800;color:{status_color};margin-top:4px;white-space:nowrap;">{attendance_status}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 4px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check In</div>
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:4px;white-space:nowrap;">{check_in_time}</div>
      </td>
      <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 4px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check Out</div>
        <div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:4px;white-space:nowrap;">{check_out_time}</div>
      </td>
      <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 4px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Work Hours</div>
        <div style="font-size:13px;font-weight:800;color:#1d4ed8;margin-top:4px;white-space:nowrap;">{working_hours}</div>
      </td>
      <td style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:10px 4px;text-align:center;width:20%;">
        <div style="font-size:9px;color:#92400e;font-weight:700;text-transform:uppercase;">Travelled</div>
        <div style="font-size:13px;font-weight:800;color:#d97706;margin-top:4px;white-space:nowrap;">{kms_travelled}</div>
      </td>
    </tr></table>
  </td></tr>

  <!-- SECTION 2: ACTIVITY SUMMARY -->
  <tr><td style="background:#ffffff;padding:0 24px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">2. Activity Summary</div>
    <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px 0;margin-bottom:16px;table-layout:fixed;"><tr>
      <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 6px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#166534;font-weight:700;text-transform:uppercase;">Prospect Calls</div>
        <div style="font-size:22px;font-weight:800;color:#059669;margin-top:4px;line-height:1;">{prospect_calls}</div>
      </td>
      <td style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 6px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Follow-ups</div>
        <div style="font-size:22px;font-weight:800;color:#2563eb;margin-top:4px;line-height:1;">{followup_calls}</div>
      </td>
      <td style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 6px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#92400e;font-weight:700;text-transform:uppercase;">New Leads</div>
        <div style="font-size:22px;font-weight:800;color:#d97706;margin-top:4px;line-height:1;">{new_leads_count}</div>
      </td>
      <td style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:12px 6px;text-align:center;width:25%;">
        <div style="font-size:9px;color:#5b21b6;font-weight:700;text-transform:uppercase;">Sites Visited</div>
        <div style="font-size:22px;font-weight:800;color:#7c3aed;margin-top:4px;line-height:1;">{sites_count}</div>
      </td>
    </tr></table>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{sites_visited}</div>
  </td></tr>

  <!-- SECTION 3: NEW LEADS ADDED TODAY -->
  <tr><td style="background:#ffffff;padding:0 24px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">3. New Leads Added Today</div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{new_leads_table}</div>
  </td></tr>

  <!-- SECTION 4: ACTIVITY METRICS — TARGET VS ACTUAL -->
  <tr><td style="background:#ffffff;padding:0 24px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">4. Activity Metrics &mdash; Target vs Actual</div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{metrics_table}</div>
  </td></tr>

  <!-- SECTION 5: CRM PIPELINE SNAPSHOT -->
  <tr><td style="background:#ffffff;padding:0 24px 20px;">
    <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9;">5. CRM Pipeline Snapshot</div>
    <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{pipeline_snapshot}</div>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 12px 12px;padding:16px 24px;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0"><tr>
      <td><p style="margin:0;font-size:11px;color:#6b7280;">&copy; Paradigm FMS &middot; BD Daily Report</p></td>
      <td style="text-align:right;"><p style="margin:0;font-size:10px;color:#16a34a;text-transform:uppercase;font-weight:700;letter-spacing:1px;">Confidential Internal</p></td>
    </tr></table>
  </td></tr>

</table>
</body>
</html>`;
}

async function renderBDForUser(userObj, dateStr) {
  const startOfTodayUTC = new Date(`${dateStr}T00:00:00+05:30`);
  const endOfTodayUTC = new Date(`${dateStr}T23:59:59.999+05:30`);

  const [eventsRes, leadsRes, callsRes, allLeadsRes] = await Promise.all([
    supabase.from('attendance_events').select('user_id, type, timestamp, latitude, longitude, location_name, travel_distance').gte('timestamp', startOfTodayUTC.toISOString()).lte('timestamp', endOfTodayUTC.toISOString()).order('timestamp', { ascending: true }),
    supabase.from('crm_leads').select('id, created_by, assigned_to, client_name, association_name, contact_person, status, source, city, created_at').gte('created_at', startOfTodayUTC.toISOString()).lte('created_at', endOfTodayUTC.toISOString()),
    supabase.from('crm_followups').select('created_by, type, outcome, lead_id, created_at, next_followup_date').gte('created_at', startOfTodayUTC.toISOString()).lte('created_at', endOfTodayUTC.toISOString()),
    supabase.from('crm_leads').select('id, created_by, assigned_to, client_name, association_name, contact_person, status, source, city, created_at')
  ]);

  const bd = userObj;
  const events = eventsRes.data || [];
  const leads = leadsRes.data || [];
  const calls = callsRes.data || [];
  const allLeads = allLeadsRes.data || [];

  const bdEvents = [...events.filter(e => e.user_id === bd.id)].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const isPresent = bdEvents.length > 0;
  const attendance_status = isPresent ? 'Present' : 'Absent';
  const status_bg = isPresent ? '#f0fdf4' : '#fef2f2';
  const status_border = isPresent ? '#bbf7d0' : '#fecaca';
  const status_color = isPresent ? '#059669' : '#dc2626';

  const firstPunchIn = bdEvents.find(e => e.type === 'punch-in' || e.type === 'site-in' || e.type === 'site-ot-in' || e.type === 'check_in');
  const lastPunchOut = [...bdEvents].reverse().find(e => e.type === 'punch-out' || e.type === 'site-out' || e.type === 'site-ot-out' || e.type === 'check_out');
  let check_in_time = 'N/A';
  let check_out_time = 'N/A';
  if (firstPunchIn) check_in_time = formatTimeIST(firstPunchIn.timestamp);
  if (lastPunchOut && lastPunchOut !== firstPunchIn) {
    check_out_time = formatTimeIST(lastPunchOut.timestamp);
  } else if (firstPunchIn) {
    check_out_time = 'Pending';
  }

  let working_hours = '0h 0m';
  if (firstPunchIn && lastPunchOut && lastPunchOut !== firstPunchIn) {
    const totalMs = new Date(lastPunchOut.timestamp).getTime() - new Date(firstPunchIn.timestamp).getTime();
    if (totalMs > 0) {
      let breakMs = 0; let lastBreakInTs = null;
      bdEvents.forEach(e => {
        if (e.type === 'break-in') { lastBreakInTs = new Date(e.timestamp).getTime(); }
        else if (e.type === 'break-out' && lastBreakInTs !== null) { breakMs += new Date(e.timestamp).getTime() - lastBreakInTs; lastBreakInTs = null; }
      });
      const netMs = Math.max(0, totalMs - breakMs);
      working_hours = `${Math.floor(netMs / 3600000)}h ${Math.floor((netMs % 3600000) / 60000)}m`;
    }
  } else if (firstPunchIn) {
    const elapsedMs = Math.max(0, new Date().getTime() - new Date(firstPunchIn.timestamp).getTime());
    working_hours = `${Math.floor(elapsedMs / 3600000)}h ${Math.floor((elapsedMs % 3600000) / 60000)}m`;
  }

  const rawKm = calculateDailyTravelKm(bdEvents);
  const kms_travelled = rawKm > 0 ? `${rawKm.toFixed(2)} km` : '0.00 km';

  const newLeadsToday = leads.filter(l => l.created_by === bd.id || l.assigned_to === bd.id);
  const newLeadsIds = new Set(newLeadsToday.map(l => l.id));
  const isCallType = t => ['call', 'phone call', 'outbound call'].includes((t || '').toLowerCase());
  const isSiteVisitType = t => ['site visit', 'sitevisit', 'site-visit'].includes((t || '').toLowerCase());
  const allBDLeads = allLeads.filter(l => l.assigned_to === bd.id || l.created_by === bd.id);
  const allBDLeadIds = new Set(allBDLeads.map(l => l.id));
  const bdCalls = calls.filter(c => c.created_by === bd.id || allBDLeadIds.has(c.lead_id));
  const prospect_calls = bdCalls.filter(c => isCallType(c.type) && newLeadsIds.has(c.lead_id)).length;
  const followup_calls = bdCalls.filter(c => !newLeadsIds.has(c.lead_id) && !isSiteVisitType(c.type)).length;
  const new_leads_count = newLeadsToday.length;
  const siteVisitsFromCRM = bdCalls.filter(c => isSiteVisitType(c.type)).length;
  const siteVisitsFromAttendance = bdEvents.filter(e => e.type === 'site-in').length;
  const sites_count = Math.max(siteVisitsFromCRM, siteVisitsFromAttendance);

  const siteVisitsList = bdEvents.filter(e => e.type === 'site-in');
  let sites_visited = '';
  if (siteVisitsList.length > 0) {
    sites_visited = `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Time</th><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Site / Location Visited</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Distance</th></tr></thead><tbody>` +
      siteVisitsList.map((sv, i) => {
        const timeStr = formatTimeIST(sv.timestamp);
        const locStr = sv.location_name || 'Site Location';
        const distStr = sv.travel_distance ? `${Number(sv.travel_distance).toFixed(1)} km` : '-';
        return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td style="padding:10px 14px;color:#0284c7;font-weight:700;border-top:1px solid #f1f5f9;white-space:nowrap;">${timeStr}</td><td style="padding:10px 14px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;">${locStr}</td><td style="padding:10px 14px;text-align:center;color:#64748b;border-top:1px solid #f1f5f9;white-space:nowrap;">${distStr}</td></tr>`;
      }).join('') +
      `</tbody></table>`;
  } else {
    sites_visited = `<div style="padding:14px;text-align:center;color:#94a3b8;font-style:italic;">No physical site visits logged today.</div>`;
  }

  // Section 3: New Leads Table
  const stageColor = { 'Negotiation': '#f97316', 'Proposal Sent': '#ec4899', 'Survey Completed': '#06b6d4', 'Site Visit Planned': '#f59e0b', 'Contacted': '#8b5cf6', 'New Lead': '#3b82f6', 'Won': '#10b981', 'Lost': '#ef4444' };
  let new_leads_table = `<div style="padding:16px;text-align:center;color:#94a3b8;font-style:italic;">No new leads added today.</div>`;
  if (newLeadsToday.length > 0) {
    new_leads_table = `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Company / Client</th><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Contact Person</th><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">City</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</th></tr></thead><tbody>` +
      newLeadsToday.map((lead, i) => {
        const sc = stageColor[lead.status] || '#64748b';
        const name = lead.client_name || lead.association_name || 'Lead';
        return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td style="padding:12px 14px;color:#1e293b;font-weight:600;border-top:1px solid #f1f5f9;">${name}</td><td style="padding:12px 14px;color:#475569;border-top:1px solid #f1f5f9;">${lead.contact_person || '-'}</td><td style="padding:12px 14px;color:#64748b;border-top:1px solid #f1f5f9;">${lead.city || '-'}</td><td style="padding:12px 14px;text-align:center;border-top:1px solid #f1f5f9;"><span style="background:${sc}20;color:${sc};padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;">${lead.status}</span></td></tr>`;
      }).join('') + `</tbody></table>`;
  }

  // Section 4: Activity Metrics — Target vs Actual
  const targets = [
    { metric: 'Outbound Calls (New Prospects)', target: 15, actual: prospect_calls, unit: '' },
    { metric: 'Follow-up Calls / Interactions', target: 15, actual: followup_calls, unit: '' },
    { metric: 'Site Visits Conducted', target: 2, actual: sites_count, unit: '' },
    { metric: 'New Leads Added', target: 2, actual: new_leads_count, unit: '' },
    { metric: 'KMs Travelled', target: 20, actual: rawKm, unit: 'km' }
  ];

  const metrics_table = `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Metric</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Daily Target</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Actual</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Achievement</th></tr></thead><tbody>` +
    targets.map((row, i) => {
      const pct = Math.min(200, Math.round((row.actual / row.target) * 100));
      let badgeBg = '#f1f5f9';
      let badgeColor = '#64748b';
      let badgeLabel = `${pct}%`;
      if (pct >= 100) {
        badgeBg = '#f0fdf4';
        badgeColor = '#059669';
        badgeLabel = `100% Met`;
      } else if (pct > 0) {
        badgeBg = '#fef3c7';
        badgeColor = '#d97706';
        badgeLabel = `${pct}% In Progress`;
      } else {
        badgeLabel = `0% Pending`;
      }

      const displayTarget = row.unit ? `${row.target} ${row.unit}` : String(row.target);
      const displayActual = row.unit ? `${row.actual.toFixed(2)} ${row.unit}` : String(row.actual);

      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};"><td style="padding:12px 14px;color:#1e293b;font-weight:600;border-top:1px solid #f1f5f9;">${row.metric}</td><td style="padding:12px 14px;text-align:center;color:#64748b;font-weight:500;border-top:1px solid #f1f5f9;">${displayTarget}</td><td style="padding:12px 14px;text-align:center;font-weight:700;color:#0f172a;border-top:1px solid #f1f5f9;">${displayActual}</td><td style="padding:12px 14px;text-align:center;border-top:1px solid #f1f5f9;"><span style="background:${badgeBg};color:${badgeColor};padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;">${badgeLabel}</span></td></tr>`;
    }).join('') +
    `</tbody></table>`;

  // Section 5: CRM Pipeline Snapshot
  const allStages = ['New Lead', 'Contacted', 'Site Visit Planned', 'Survey Completed', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
  let activeTotal = 0;
  const pipelineRows = allStages.map(stage => {
    const count = allBDLeads.filter(l => l.status === stage).length;
    if (!['Won', 'Lost'].includes(stage)) activeTotal += count;
    return { stage, count, color: stageColor[stage] || '#64748b' };
  });

  const pipeline_snapshot = `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Stage</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Assigned Leads</th><th style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Share of Active</th></tr></thead><tbody>` +
    pipelineRows.map((row, i) => {
      const isClosed = ['Won', 'Lost'].includes(row.stage);
      const share = (!isClosed && activeTotal > 0 && row.count > 0) ? `${Math.round((row.count / activeTotal) * 100)}%` : '—';
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};"><td style="padding:12px 14px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${row.color};margin-right:8px;vertical-align:middle;"></span>${row.stage}</td><td style="padding:12px 14px;text-align:center;font-size:13px;font-weight:700;color:${row.color};border-top:1px solid #f1f5f9;">${row.count}</td><td style="padding:12px 14px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #f1f5f9;">${share}</td></tr>`;
    }).join('') +
    `</tbody></table><div style="padding:10px 14px;background:#f0fdf4;border-top:1px solid #bbf7d0;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;">Total Active Pipeline</span><span style="font-size:13px;font-weight:800;color:#15803d;">${activeTotal} Leads</span></div>`;

  const dObj = new Date(`${dateStr}T12:00:00+05:30`);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const formattedDate = `${String(dObj.getDate()).padStart(2,'0')} ${months[dObj.getMonth()]} ${dObj.getFullYear()}`;

  const data = {
    bd_name: bd.name,
    report_date: formattedDate,
    attendance_status,
    status_bg,
    status_border,
    status_color,
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
  };

  let html = buildTemplate();
  Object.keys(data).forEach(k => {
    html = html.replace(new RegExp(`{${k}}`, 'g'), data[k]);
  });

  const outPath = `test_rendered_${bd.name.toLowerCase().replace(/\s+/g, '_')}_${dateStr}.html`;
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`Saved rendered HTML to ${outPath}`);
}

async function main() {
  const { data: users } = await supabase.from('users').select('*').in('name', ['Nakul R Alvar', 'Pravin Prasad']);
  for (const u of (users || [])) {
    await renderBDForUser(u, '2026-10-05');
    await renderBDForUser(u, '2026-10-06');
  }
}
main();
