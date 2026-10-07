const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
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
    let haversineDist = 0;
    for (let i = 0; i < sess.length - 1; i++) {
      const current = sess[i];
      const next = sess[i + 1];
      if (current.latitude && current.longitude && next.latitude && next.longitude) {
        const toRad = deg => (deg * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(next.latitude - current.latitude);
        const dLon = toRad(next.longitude - current.longitude);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(current.latitude)) * Math.cos(toRad(next.latitude)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        haversineDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
    }
    if (deviceDist > 0) {
      if (deviceDist > 100 && haversineDist < 30) totalDailyKm += haversineDist;
      else totalDailyKm += Math.max(deviceDist, haversineDist);
    } else {
      totalDailyKm += haversineDist;
    }
  });
  return Number(totalDailyKm.toFixed(2));
}

function buildResponsiveTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>BD Daily Activity Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style type="text/css">
    /* Base resets */
    body, table, td, p, a, div {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      background-color: #f1f5f9;
      color: #1e293b;
      margin: 0;
      padding: 16px 8px;
    }
    table {
      border-collapse: separate;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      outline: none;
      text-decoration: none;
    }

    /* Mobile specific (< 600px) */
    @media only screen and (max-width: 600px) {
      body {
        padding: 6px 4px !important;
      }
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 8px !important;
      }
      .header-cell {
        padding: 14px 12px !important;
      }
      .section-box {
        padding: 14px 10px !important;
      }
      .section-box-bottom {
        padding: 0 10px 14px !important;
      }
      .header-logo {
        height: 28px !important;
      }
      .header-badge {
        padding: 6px 10px !important;
      }
      .header-date-text {
        font-size: 13px !important;
      }
      .header-name-text {
        font-size: 10px !important;
      }
      /* Top 5 cards mobile */
      .top-card-cell {
        padding: 7px 2px !important;
      }
      .top-card-lbl {
        font-size: 8px !important;
      }
      .top-card-val {
        font-size: 11px !important;
      }
      /* Activity 4 cards */
      .stat-card-cell {
        padding: 8px 3px !important;
      }
      .stat-card-lbl {
        font-size: 8px !important;
      }
      .stat-card-val {
        font-size: 17px !important;
      }
      /* Table styling */
      .th-cell {
        padding: 8px 6px !important;
        font-size: 9px !important;
      }
      .td-cell {
        padding: 8px 6px !important;
        font-size: 11px !important;
      }
      .badge-cell {
        padding: 2px 6px !important;
        font-size: 9px !important;
      }
      .pipeline-footer {
        padding: 8px 10px !important;
        font-size: 11px !important;
      }
      .footer-cell {
        padding: 12px 10px !important;
      }
    }

    /* Tablet specific (601px - 850px) */
    @media only screen and (min-width: 601px) and (max-width: 850px) {
      body {
        padding: 12px 8px !important;
      }
      .email-container {
        width: 100% !important;
        max-width: 720px !important;
      }
      .header-cell {
        padding: 18px 20px !important;
      }
      .section-box {
        padding: 16px 18px !important;
      }
      .section-box-bottom {
        padding: 0 18px 16px !important;
      }
      .top-card-val {
        font-size: 12px !important;
      }
    }

    /* Laptop / Desktop (851px+) */
    @media only screen and (min-width: 851px) {
      .email-container {
        width: 100% !important;
        max-width: 760px !important;
      }
    }
  </style>
</head>
<body style="background:#f1f5f9;margin:0;padding:16px 8px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05);table-layout:fixed;">

  <!-- HEADER -->
  <tr>
    <td class="header-cell" style="background:#ffffff;padding:20px 24px;border-bottom:4px solid #16a34a;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="middle" width="50%">
            <img src="https://app.paradigmfms.com/Paradigm-Logo-3-1024x157.png" alt="Paradigm" class="header-logo" style="height:34px;max-width:140px;display:block;">
            <div style="margin-top:6px;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Business Development</div>
          </td>
          <td valign="top" align="right" width="50%">
            <div class="header-badge" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;display:inline-block;text-align:left;">
              <div style="font-size:9px;color:#166534;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;">Daily Activity Report</div>
              <div class="header-date-text" style="font-size:15px;color:#15803d;font-weight:800;margin-top:2px;white-space:nowrap;">{report_date}</div>
              <div class="header-name-text" style="font-size:11px;color:#374151;margin-top:2px;">BD: <strong>{bd_name}</strong></div>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SECTION 1: ATTENDANCE & TIME -->
  <tr>
    <td class="section-box" style="background:#ffffff;padding:18px 24px;">
      <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f1f5f9;">1. Attendance &amp; Time</div>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:3px 0;table-layout:fixed;">
        <tr>
          <td class="top-card-cell" style="background:{status_bg};border:1px solid {status_border};border-radius:8px;padding:9px 4px;text-align:center;width:20%;">
            <div class="top-card-lbl" style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</div>
            <div class="top-card-val" style="font-size:13px;font-weight:800;color:{status_color};margin-top:3px;white-space:nowrap;">{attendance_status}</div>
          </td>
          <td class="top-card-cell" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 4px;text-align:center;width:20%;">
            <div class="top-card-lbl" style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check In</div>
            <div class="top-card-val" style="font-size:13px;font-weight:700;color:#1e293b;margin-top:3px;white-space:nowrap;">{check_in_time}</div>
          </td>
          <td class="top-card-cell" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 4px;text-align:center;width:20%;">
            <div class="top-card-lbl" style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;">Check Out</div>
            <div class="top-card-val" style="font-size:13px;font-weight:700;color:#1e293b;margin-top:3px;white-space:nowrap;">{check_out_time}</div>
          </td>
          <td class="top-card-cell" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:9px 4px;text-align:center;width:20%;">
            <div class="top-card-lbl" style="font-size:9px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Work Hours</div>
            <div class="top-card-val" style="font-size:13px;font-weight:800;color:#1d4ed8;margin-top:3px;white-space:nowrap;">{working_hours}</div>
          </td>
          <td class="top-card-cell" style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:9px 4px;text-align:center;width:20%;">
            <div class="top-card-lbl" style="font-size:9px;color:#92400e;font-weight:700;text-transform:uppercase;">Travelled</div>
            <div class="top-card-val" style="font-size:13px;font-weight:800;color:#d97706;margin-top:3px;white-space:nowrap;">{kms_travelled}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- SECTION 2: ACTIVITY SUMMARY -->
  <tr>
    <td class="section-box-bottom" style="background:#ffffff;padding:0 24px 18px;">
      <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f1f5f9;">2. Activity Summary</div>
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:4px 0;margin-bottom:14px;table-layout:fixed;">
        <tr>
          <td class="stat-card-cell" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 4px;text-align:center;width:25%;">
            <div class="stat-card-lbl" style="font-size:9px;color:#166534;font-weight:700;text-transform:uppercase;">Prospect Calls</div>
            <div class="stat-card-val" style="font-size:20px;font-weight:800;color:#059669;margin-top:3px;line-height:1;">{prospect_calls}</div>
          </td>
          <td class="stat-card-cell" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 4px;text-align:center;width:25%;">
            <div class="stat-card-lbl" style="font-size:9px;color:#1d4ed8;font-weight:700;text-transform:uppercase;">Follow-ups</div>
            <div class="stat-card-val" style="font-size:20px;font-weight:800;color:#2563eb;margin-top:3px;line-height:1;">{followup_calls}</div>
          </td>
          <td class="stat-card-cell" style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 4px;text-align:center;width:25%;">
            <div class="stat-card-lbl" style="font-size:9px;color:#92400e;font-weight:700;text-transform:uppercase;">New Leads</div>
            <div class="stat-card-val" style="font-size:20px;font-weight:800;color:#d97706;margin-top:3px;line-height:1;">{new_leads_count}</div>
          </td>
          <td class="stat-card-cell" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:10px 4px;text-align:center;width:25%;">
            <div class="stat-card-lbl" style="font-size:9px;color:#5b21b6;font-weight:700;text-transform:uppercase;">Sites Visited</div>
            <div class="stat-card-val" style="font-size:20px;font-weight:800;color:#7c3aed;margin-top:3px;line-height:1;">{sites_count}</div>
          </td>
        </tr>
      </table>
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{sites_visited}</div>
    </td>
  </tr>

  <!-- SECTION 3: NEW LEADS ADDED TODAY -->
  <tr>
    <td class="section-box-bottom" style="background:#ffffff;padding:0 24px 18px;">
      <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f1f5f9;">3. New Leads Added Today</div>
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{new_leads_table}</div>
    </td>
  </tr>

  <!-- SECTION 4: ACTIVITY METRICS — TARGET VS ACTUAL -->
  <tr>
    <td class="section-box-bottom" style="background:#ffffff;padding:0 24px 18px;">
      <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f1f5f9;">4. Activity Metrics &mdash; Target vs Actual</div>
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{metrics_table}</div>
    </td>
  </tr>

  <!-- SECTION 5: CRM PIPELINE SNAPSHOT -->
  <tr>
    <td class="section-box-bottom" style="background:#ffffff;padding:0 24px 18px;">
      <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f1f5f9;">5. CRM Pipeline Snapshot</div>
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:12px;">{pipeline_snapshot}</div>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td class="footer-cell" style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 24px;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td><p style="margin:0;font-size:11px;color:#6b7280;">&copy; Paradigm FMS &middot; BD Daily Report</p></td>
          <td style="text-align:right;"><p style="margin:0;font-size:10px;color:#16a34a;text-transform:uppercase;font-weight:700;letter-spacing:0.8px;">Confidential Internal</p></td>
        </tr>
      </table>
    </td>
  </tr>

</table>
</body>
</html>`;
}

async function renderBD(bdName, dateStr) {
  const { data: users } = await supabase.from('users').select('*').eq('name', bdName).limit(1);
  const bd = users[0];
  const { data: events } = await supabase.from('attendance_events').select('*').eq('user_id', bd.id).gte('timestamp', `${dateStr}T00:00:00+05:30`).lte('timestamp', `${dateStr}T23:59:59+05:30`);
  const { data: leads } = await supabase.from('crm_leads').select('*').gte('created_at', `${dateStr}T00:00:00+05:30`).lte('created_at', `${dateStr}T23:59:59+05:30`);
  const { data: calls } = await supabase.from('crm_activities').select('*').gte('created_at', `${dateStr}T00:00:00+05:30`).lte('created_at', `${dateStr}T23:59:59+05:30`);
  const { data: allLeads } = await supabase.from('crm_leads').select('*');

  const bdEvents = events || [];
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

  const newLeadsToday = (leads || []).filter(l => l.created_by === bd.id || l.assigned_to === bd.id);
  const newLeadsIds = new Set(newLeadsToday.map(l => l.id));
  const isCallType = t => ['call', 'phone call', 'outbound call'].includes((t || '').toLowerCase());
  const isSiteVisitType = t => ['site visit', 'sitevisit', 'site-visit'].includes((t || '').toLowerCase());
  const allBDLeads = (allLeads || []).filter(l => l.assigned_to === bd.id || l.created_by === bd.id);
  const allBDLeadIds = new Set(allBDLeads.map(l => l.id));
  const bdCalls = (calls || []).filter(c => c.created_by === bd.id || allBDLeadIds.has(c.lead_id));
  const prospect_calls = bdCalls.filter(c => isCallType(c.type) && newLeadsIds.has(c.lead_id)).length;
  const followup_calls = bdCalls.filter(c => !newLeadsIds.has(c.lead_id) && !isSiteVisitType(c.type)).length;
  const new_leads_count = newLeadsToday.length;
  const siteVisitsFromCRM = bdCalls.filter(c => isSiteVisitType(c.type)).length;
  const siteVisitsFromAttendance = bdEvents.filter(e => e.type === 'site-in').length;
  const sites_count = Math.max(siteVisitsFromCRM, siteVisitsFromAttendance);

  const siteVisitsList = bdEvents.filter(e => e.type === 'site-in');
  let sites_visited = '';
  if (siteVisitsList.length > 0) {
    sites_visited = `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th class="th-cell" style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;width:75px;">Time</th><th class="th-cell" style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Site / Location Visited</th><th class="th-cell" style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;width:70px;">Distance</th></tr></thead><tbody>` +
      siteVisitsList.map((sv, i) => {
        const timeStr = formatTimeIST(sv.timestamp);
        const locStr = sv.location_name || 'Site Location';
        const distStr = sv.travel_distance ? `${Number(sv.travel_distance).toFixed(1)} km` : '-';
        return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td class="td-cell" style="padding:10px 14px;color:#0284c7;font-weight:700;border-top:1px solid #f1f5f9;white-space:nowrap;">${timeStr}</td><td class="td-cell" style="padding:10px 14px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;word-break:break-word;">${locStr}</td><td class="td-cell" style="padding:10px 14px;text-align:center;color:#64748b;border-top:1px solid #f1f5f9;white-space:nowrap;">${distStr}</td></tr>`;
      }).join('') +
      `</tbody></table>`;
  } else {
    sites_visited = `<div style="padding:14px;text-align:center;color:#94a3b8;font-style:italic;">No physical site visits logged today.</div>`;
  }

  let new_leads_table = '';
  if (newLeadsToday.length > 0) {
    new_leads_table = `<table width="100%" style="border-collapse:collapse;font-size:12px;"><thead><tr style="background:#f8fafc;"><th class="th-cell" style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Company / Client</th><th class="th-cell" style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Contact Person</th><th class="th-cell" style="padding:10px 14px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">City</th><th class="th-cell" style="padding:10px 14px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Status</th></tr></thead><tbody>` +
      newLeadsToday.map((l, i) => {
        return `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td class="td-cell" style="padding:10px 14px;color:#1e293b;font-weight:600;border-top:1px solid #f1f5f9;word-break:break-word;">${l.title || l.company_name || 'Lead'}</td><td class="td-cell" style="padding:10px 14px;color:#475569;border-top:1px solid #f1f5f9;">${l.contact_name || '—'}</td><td class="td-cell" style="padding:10px 14px;color:#475569;border-top:1px solid #f1f5f9;">${l.city || 'Bangalore'}</td><td class="td-cell" style="padding:10px 14px;text-align:center;border-top:1px solid #f1f5f9;"><span class="badge-cell" style="background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;">${l.status || 'New'}</span></td></tr>`;
      }).join('') +
      `</tbody></table>`;
  } else {
    new_leads_table = `<div style="padding:14px;text-align:center;color:#94a3b8;font-style:italic;">No new leads added today.</div>`;
  }

  const metricsConfig = [
    { name: 'Outbound Calls (New Prospects)', target: 15, actual: prospect_calls, unit: '' },
    { name: 'Follow-up Calls / Interactions', target: 15, actual: followup_calls, unit: '' },
    { name: 'Site Visits Conducted', target: 2, actual: sites_count, unit: '' },
    { name: 'New Leads Added', target: 2, actual: new_leads_count, unit: '' },
    { name: 'KMs Travelled', target: 20, actual: rawKm, unit: ' km' }
  ];

  let metrics_table = `<table width="100%" style="border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="background:#f8fafc;">
        <th class="th-cell" style="padding:10px 12px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Metric</th>
        <th class="th-cell" style="padding:10px 8px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;width:60px;">Target</th>
        <th class="th-cell" style="padding:10px 8px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;width:60px;">Actual</th>
        <th class="th-cell" style="padding:10px 8px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;width:80px;">Achievement</th>
      </tr>
    </thead>
    <tbody>`;

  metricsConfig.forEach((m, idx) => {
    const pct = m.target > 0 ? Math.round((m.actual / m.target) * 100) : 0;
    let badgeBg = '#f1f5f9';
    let badgeColor = '#64748b';
    let badgeText = `${pct}% Pending`;
    if (pct >= 100) {
      badgeBg = '#f0fdf4';
      badgeColor = '#059669';
      badgeText = '100% Met';
    } else if (pct > 0) {
      badgeBg = '#fef3c7';
      badgeColor = '#d97706';
      badgeText = `${pct}% In Progress`;
    }
    const bgRow = idx % 2 === 0 ? '#fff' : '#f8fafc';
    const displayTarget = m.unit ? `${m.target}${m.unit}` : String(m.target);
    const displayActual = m.unit ? `${m.actual.toFixed(2)}${m.unit}` : String(m.actual);
    metrics_table += `<tr style="background:${bgRow};">
      <td class="td-cell" style="padding:10px 12px;color:#1e293b;font-weight:600;border-top:1px solid #f1f5f9;word-break:break-word;">${m.name}</td>
      <td class="td-cell" style="padding:10px 8px;text-align:center;color:#64748b;font-weight:500;border-top:1px solid #f1f5f9;white-space:nowrap;">${displayTarget}</td>
      <td class="td-cell" style="padding:10px 8px;text-align:center;font-weight:700;color:#0f172a;border-top:1px solid #f1f5f9;white-space:nowrap;">${displayActual}</td>
      <td class="td-cell" style="padding:10px 8px;text-align:center;border-top:1px solid #f1f5f9;white-space:nowrap;">
        <span class="badge-cell" style="background:${badgeBg};color:${badgeColor};padding:3px 8px;border-radius:12px;font-size:10px;font-weight:700;display:inline-block;">${badgeText}</span>
      </td>
    </tr>`;
  });
  metrics_table += `</tbody></table>`;

  const STAGES = [
    { key: 'new', label: 'New Lead', color: '#3b82f6' },
    { key: 'contacted', label: 'Contacted', color: '#8b5cf6' },
    { key: 'site_visit_planned', label: 'Site Visit Planned', color: '#f59e0b' },
    { key: 'survey_completed', label: 'Survey Completed', color: '#06b6d4' },
    { key: 'proposal_sent', label: 'Proposal Sent', color: '#ec4899' },
    { key: 'negotiation', label: 'Negotiation', color: '#f97316' },
    { key: 'won', label: 'Won', color: '#10b981' },
    { key: 'lost', label: 'Lost', color: '#ef4444' }
  ];

  const normalizeStageKey = (status) => {
    if (!status) return 'new';
    const s = status.toLowerCase().replace(/[\s-]+/g, '_').trim();
    if (s.includes('site') || s.includes('visit')) return 'site_visit_planned';
    if (s.includes('survey')) return 'survey_completed';
    if (s.includes('proposal') || s.includes('quote')) return 'proposal_sent';
    if (s.includes('nego')) return 'negotiation';
    if (s.includes('won') || s.includes('closed_won')) return 'won';
    if (s.includes('lost') || s.includes('closed_lost') || s.includes('drop')) return 'lost';
    if (s.includes('contact')) return 'contacted';
    return 'new';
  };

  const stageCounts = {};
  STAGES.forEach(s => stageCounts[s.key] = 0);
  allBDLeads.forEach(l => {
    const k = normalizeStageKey(l.status);
    if (stageCounts[k] !== undefined) stageCounts[k]++;
    else stageCounts.new++;
  });

  const totalActivePipeline = (stageCounts.new || 0) +
    (stageCounts.contacted || 0) +
    (stageCounts.site_visit_planned || 0) +
    (stageCounts.survey_completed || 0) +
    (stageCounts.proposal_sent || 0) +
    (stageCounts.negotiation || 0);

  let pipeline_snapshot = `<table width="100%" style="border-collapse:collapse;font-size:12px;">
    <thead>
      <tr style="background:#f8fafc;">
        <th class="th-cell" style="padding:10px 12px;text-align:left;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;">Stage</th>
        <th class="th-cell" style="padding:10px 8px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;width:75px;">Assigned</th>
        <th class="th-cell" style="padding:10px 8px;text-align:center;font-size:10px;color:#6b7280;font-weight:700;text-transform:uppercase;width:75px;">Active %</th>
      </tr>
    </thead>
    <tbody>`;

  STAGES.forEach((stg, idx) => {
    const count = stageCounts[stg.key] || 0;
    const isClosed = stg.key === 'won' || stg.key === 'lost';
    const pctShare = (!isClosed && totalActivePipeline > 0) ? `${Math.round((count / totalActivePipeline) * 100)}%` : '—';
    const bgRow = idx % 2 === 0 ? '#fff' : '#f8fafc';
    pipeline_snapshot += `<tr style="background:${bgRow};">
      <td class="td-cell" style="padding:9px 12px;color:#1e293b;font-weight:500;border-top:1px solid #f1f5f9;">
        <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${stg.color};margin-right:6px;vertical-align:middle;"></span>${stg.label}
      </td>
      <td class="td-cell" style="padding:9px 8px;text-align:center;font-size:12px;font-weight:700;color:${count > 0 ? stg.color : '#94a3b8'};border-top:1px solid #f1f5f9;">${count}</td>
      <td class="td-cell" style="padding:9px 8px;text-align:center;font-size:11px;color:#64748b;border-top:1px solid #f1f5f9;">${pctShare}</td>
    </tr>`;
  });

  pipeline_snapshot += `</tbody></table>
  <div class="pipeline-footer" style="padding:9px 14px;background:#f0fdf4;border-top:1px solid #bbf7d0;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;">Total Active Pipeline</span>
    <span style="font-size:13px;font-weight:800;color:#15803d;">${totalActivePipeline} Leads</span>
  </div>`;

  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const formattedDate = `${d} ${months[parseInt(m)-1]} ${y}`;

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

  let html = buildResponsiveTemplate();
  Object.keys(data).forEach(k => {
    html = html.replace(new RegExp(`{${k}}`, 'g'), data[k]);
  });

  return html;
}

async function main() {
  const html = await renderBD('Nakul R Alvar', '2026-10-06');
  fs.writeFileSync('public/test_responsive_bd.html', html, 'utf-8');
  console.log('Successfully created public/test_responsive_bd.html');
}
main();
