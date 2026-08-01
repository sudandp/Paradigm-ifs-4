/**
 * Manually trigger the BD Daily Report for Nakul R Alvar
 * and send it to admin@paradigmfms.com (Sudhan M)
 * This uses the YESTERDAY date (31 Jul 2026) as the report date.
 */

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '', supabaseKey = '', smtpHost = '', smtpUser = '', smtpPass = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function toIST(d) {
  return new Date(new Date(d).getTime() + IST_OFFSET);
}

function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


function fmtTime(isoStr) {
  if (!isoStr) return 'N/A';
  const d = toIST(isoStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

async function generateAndSendReport() {
  console.log('Fetching SMTP config from settings table...');
  const { data: settings } = await supabase.from('settings').select('email_config').eq('id', 'singleton').maybeSingle();
  const cfg = settings?.email_config || {};
  
  const smtpConfig = {
    host: cfg.host || 'smtp.gmail.com',
    port: parseInt(cfg.port || '587'),
    secure: cfg.secure || false,
    user: cfg.user || '',
    pass: cfg.pass || '',
    fromEmail: cfg.from_email || cfg.user || '',
    fromName: cfg.from_name || 'Paradigm FMS'
  };
  
  console.log('SMTP Host:', smtpConfig.host);
  console.log('SMTP User:', smtpConfig.user ? smtpConfig.user.substring(0, 5) + '...' : 'NOT SET');

  // YESTERDAY date range: 31 Jul 2026 in IST = 2026-07-30 18:30:00 UTC to 2026-07-31 18:30:00 UTC
  const startStr = '2026-07-30T18:30:00.000Z';
  const endStr = '2026-07-31T18:30:00.000Z';
  const reportDateLabel = 'Thursday, 31 July 2026';

  console.log('Fetching Nakul user data...');
  const { data: allUsers } = await supabase.from('users').select('*');
  const nakul = (allUsers || []).find(u => u.email === 'nakulalvar@paradigmfms.com');
  if (!nakul) return console.error('Nakul user not found!');
  console.log('Found user:', nakul.name, '| ID:', nakul.id);

  // Attendance events for Nakul on 31 Jul 2026
  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', nakul.id)
    .gte('timestamp', startStr)
    .lt('timestamp', endStr)
    .order('timestamp', { ascending: true });

  const bdEvents = events || [];
  const firstPunchIn = bdEvents.find(e => e.type === 'punch-in');
  const lastPunchOut = [...bdEvents].reverse().find(e => e.type === 'punch-out');
  
  const checkIn = firstPunchIn ? fmtTime(firstPunchIn.timestamp) : 'N/A';
  const checkOut = lastPunchOut ? fmtTime(lastPunchOut.timestamp) : 'N/A';
  
  let working_hours = 'N/A';
  if (firstPunchIn && lastPunchOut) {
    const netMs = new Date(lastPunchOut.timestamp).getTime() - new Date(firstPunchIn.timestamp).getTime();
    if (netMs > 0) working_hours = `${Math.floor(netMs / 3600000)}h ${Math.floor((netMs % 3600000) / 60000)}m`;
  }
  
  // Group events by session (separated by punch-in)
  const sessions = [];
  let curSession = [];
  const sortedEvents = [...bdEvents].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  sortedEvents.forEach(e => {
    if (e.type === 'punch-in') {
      if (curSession.length > 0) sessions.push(curSession);
      curSession = [e];
    } else {
      curSession.push(e);
    }
  });
  if (curSession.length > 0) sessions.push(curSession);
  
  let totalKm = 0;
  sessions.forEach(sess => {
    const deviceValues = sess.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    let deviceDist = 0;
    if (deviceValues.length > 0) {
      const maxVal = Math.max(...deviceValues);
      const minVal = Math.min(...deviceValues);
      deviceDist = maxVal - minVal;
      if (deviceValues.length === 1) {
        deviceDist = deviceValues[0] > 50 ? 0 : deviceValues[0];
      }
    }
    let haversineDist = 0;
    for (let i = 0; i < sess.length - 1; i++) {
      const current = sess[i];
      const next = sess[i + 1];
      if (current.latitude && current.longitude && next.latitude && next.longitude) {
        haversineDist += getDistance(current.latitude, current.longitude, next.latitude, next.longitude);
      }
    }
    if (deviceDist > 0) {
      if (deviceDist > 100 && haversineDist < 30) {
        totalKm += haversineDist;
      } else {
        totalKm += Math.max(deviceDist, haversineDist);
      }
    } else {
      totalKm += haversineDist;
    }
  });
  const kms_travelled = totalKm.toFixed(2);


  // All Nakul leads (all-time)
  const { data: allLeadsRaw } = await supabase.from('crm_leads').select('*');
  const allLeads = (allLeadsRaw || []).filter(l => l.created_by === nakul.id || l.assigned_to === nakul.id);
  const allLeadIds = new Set(allLeads.map(l => l.id));

  // New leads added yesterday
  const newLeads = allLeads.filter(l => l.created_at >= startStr && l.created_at < endStr);
  const new_leads_count = newLeads.length;

  // Followups yesterday
  const { data: followupsYesterday } = await supabase
    .from('crm_followups')
    .select('*')
    .gte('created_at', startStr)
    .lt('created_at', endStr);
  
  const bdFollowups = (followupsYesterday || []).filter(f => f.created_by === nakul.id || allLeadIds.has(f.lead_id));
  const isCallType = t => ['call', 'phone call', 'outbound call'].includes((t || '').toLowerCase());
  const isSiteVisitType = t => ['site visit', 'sitevisit', 'site-visit'].includes((t || '').toLowerCase());
  const newLeadIds = new Set(newLeads.map(l => l.id));
  
  const prospect_calls = bdFollowups.filter(c => isCallType(c.type) && newLeadIds.has(c.lead_id)).length;
  const followup_calls = bdFollowups.filter(c => isCallType(c.type) && !newLeadIds.has(c.lead_id)).length;
  const siteVisitsCRM = bdFollowups.filter(c => isSiteVisitType(c.type)).length;
  const siteVisitsAtt = bdEvents.filter(e => e.type === 'site-in').length;
  const sites_count = siteVisitsCRM > 0 ? siteVisitsCRM : siteVisitsAtt;

  // Pipeline breakdown
  const stages = {};
  allLeads.forEach(l => { stages[l.status] = (stages[l.status] || 0) + 1; });
  const activePipelineLeads = allLeads.filter(l => !['Won', 'Lost'].includes(l.status));
  const activeLeadsSorted = [...activePipelineLeads].sort((a, b) => {
    const order = { 'Onboarding Started': 0, 'Negotiation': 1, 'Proposal Sent': 2, 'Survey Completed': 3, 'Site Visit Planned': 4, 'Contacted': 5, 'New Lead': 6 };
    return (order[a.status] || 9) - (order[b.status] || 9);
  });

  const stageColor = {
    'New Lead': '#3b82f6', 'Contacted': '#8b5cf6', 'Site Visit Planned': '#f59e0b',
    'Survey Completed': '#06b6d4', 'Proposal Sent': '#ec4899', 'Negotiation': '#f97316',
    'Onboarding Started': '#10b981', 'Won': '#059669', 'Lost': '#ef4444'
  };

  // Pipeline table rows
  const pipelineRows = Object.entries(stages).map(([stage, count]) => {
    const color = stageColor[stage] || '#64748b';
    const icon = stage === 'Won' ? '🏆' : stage === 'Lost' ? '❌' : stage === 'Proposal Sent' ? '🩷' : stage === 'Site Visit Planned' ? '🟡' : stage === 'Negotiation' ? '🟠' : stage === 'Onboarding Started' ? '🟢' : stage === 'Contacted' ? '🟣' : '🔵';
    return `<tr><td style="padding:10px 16px;font-weight:600;color:#1e293b;">${icon} ${stage}</td><td style="padding:10px 16px;text-align:center;"><span style="background:${color}20;color:${color};font-weight:800;font-size:18px;padding:4px 14px;border-radius:20px;">${count}</span></td><td style="padding:10px 16px;text-align:center;color:#64748b;font-size:12px;">${['Won','Lost'].includes(stage) ? 'Closed' : 'Active'}</td></tr>`;
  }).join('');

  // Top active leads rows
  const topLeadsRows = activeLeadsSorted.slice(0, 10).map((l, i) => {
    const sc = stageColor[l.status] || '#64748b';
    const name = l.client_name || l.association_name || l.company_name || 'Unknown';
    const nextFollowup = l.next_followup_date ? new Date(l.next_followup_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'};"><td style="padding:10px 12px;font-weight:700;color:#94a3b8;">${i+1}</td><td style="padding:10px 12px;font-weight:600;color:#1e293b;">${name}</td><td style="padding:10px 12px;"><span style="background:${sc}20;color:${sc};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${l.status}</span></td><td style="padding:10px 12px;color:#64748b;font-size:12px;">${l.city || '—'}</td><td style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;">${nextFollowup}</td></tr>`;
  }).join('');

  const attendance_status = bdEvents.length > 0 ? 'Present' : 'Absent';
  const statusColor = attendance_status === 'Present' ? '#10b981' : '#ef4444';

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:720px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.08);border:1px solid #e2e8f0;">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:40px 40px 32px;color:white;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:11px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Paradigm Facility Management Services</div>
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;letter-spacing:-0.5px;">BD Daily Activity Report</h1>
        <div style="font-size:14px;color:#93c5fd;font-weight:500;">${reportDateLabel}</div>
      </div>
      <div style="text-align:right;">
        <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:16px 20px;">
          <div style="font-size:24px;font-weight:800;">N</div>
          <div style="font-size:11px;color:#93c5fd;font-weight:600;margin-top:4px;">Nakul R Alvar</div>
        </div>
      </div>
    </div>
  </div>

  <div style="padding:32px 40px;">

    <!-- ATTENDANCE CARD -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">⏱️ Attendance & Time Summary</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:6px;">STATUS</div>
          <div style="font-size:18px;font-weight:800;color:${statusColor};">${attendance_status === 'Present' ? '🟢' : '🔴'} ${attendance_status}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:6px;">CHECK-IN</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b;">${checkIn}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:6px;">CHECK-OUT</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b;">${checkOut}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;">
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:6px;">WORK HOURS</div>
          <div style="font-size:18px;font-weight:800;color:#1e293b;">${working_hours}</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center;border-top:3px solid #10b981;">
          <div style="font-size:11px;color:#64748b;font-weight:600;margin-bottom:6px;">KMs TRAVELLED</div>
          <div style="font-size:18px;font-weight:800;color:#10b981;">${kms_travelled} km</div>
        </div>
      </div>
    </div>

    <!-- ACTIVITY SUMMARY -->
    <div style="margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">📞 Today's CRM Activity Summary</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="flex:1;min-width:130px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:#1d4ed8;">${prospect_calls}</div>
          <div style="font-size:12px;color:#1d4ed8;font-weight:600;margin-top:6px;">New Prospect Calls</div>
        </div>
        <div style="flex:1;min-width:130px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:#7c3aed;">${followup_calls}</div>
          <div style="font-size:12px;color:#7c3aed;font-weight:600;margin-top:6px;">Follow-up Calls</div>
        </div>
        <div style="flex:1;min-width:130px;background:#fdf4ff;border:1px solid #f0abfc;border-radius:12px;padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:#a21caf;">${new_leads_count}</div>
          <div style="font-size:12px;color:#a21caf;font-weight:600;margin-top:6px;">New Leads Added</div>
        </div>
        <div style="flex:1;min-width:130px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px;text-align:center;">
          <div style="font-size:32px;font-weight:800;color:#c2410c;">${sites_count}</div>
          <div style="font-size:12px;color:#c2410c;font-weight:600;margin-top:6px;">Site Visits</div>
        </div>
      </div>
    </div>

    <!-- CRM PIPELINE SNAPSHOT -->
    <div style="margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">📊 CRM Pipeline Snapshot</div>
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:12px 16px;text-align:left;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Stage</th>
              <th style="padding:12px 16px;text-align:center;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Count</th>
              <th style="padding:12px 16px;text-align:center;color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${pipelineRows}
            <tr style="background:#f0fdf4;border-top:2px solid #a7f3d0;">
              <td style="padding:12px 16px;font-weight:800;color:#065f46;">🔥 Active Pipeline Total</td>
              <td style="padding:12px 16px;text-align:center;"><span style="background:#10b981;color:white;font-weight:800;font-size:18px;padding:4px 14px;border-radius:20px;">${activePipelineLeads.length}</span></td>
              <td style="padding:12px 16px;text-align:center;color:#10b981;font-weight:600;">In Progress</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TOP LEADS -->
    <div style="margin-bottom:28px;">
      <div style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;">🏆 Top Active Leads in Pipeline</div>
      <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">#</th>
              <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Lead / Company</th>
              <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Stage</th>
              <th style="padding:10px 12px;text-align:left;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">City</th>
              <th style="padding:10px 12px;text-align:center;color:#6b7280;font-size:10px;font-weight:700;text-transform:uppercase;">Next Followup</th>
            </tr>
          </thead>
          <tbody>${topLeadsRows}</tbody>
        </table>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="padding-top:24px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0 0 12px;color:#94a3b8;font-size:12px;">This is an automated BD Daily Report from <strong>Paradigm Facility Management Services</strong></p>
      <a href="https://app.paradigmfms.com" style="color:#3b82f6;text-decoration:none;font-size:12px;font-weight:600;">Open Dashboard →</a>
      <p style="margin:12px 0 0;color:#cbd5e1;font-size:11px;">Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
    </div>
  </div>
</div>
</body>
</html>`;

  console.log('\n=== REPORT DATA SUMMARY ===');
  console.log('Attendance:', attendance_status);
  console.log('Check-in:', checkIn, '| Check-out:', checkOut, '| Hours:', working_hours);
  console.log('KMs Travelled:', kms_travelled, 'km');
  console.log('New Prospects Calls:', prospect_calls);
  console.log('Follow-up Calls:', followup_calls);
  console.log('New Leads Today:', new_leads_count);
  console.log('Site Visits:', sites_count);
  console.log('Pipeline:', stages);
  console.log('Active Pipeline Total:', activePipelineLeads.length);

  if (!smtpConfig.user || !smtpConfig.pass) {
    console.error('\n❌ SMTP credentials not found in settings table! Cannot send email.');
    console.log('Please configure SMTP in the Admin → Email Settings panel.');
    return;
  }

  console.log('\nSending email to admin@paradigmfms.com...');
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    tls: { rejectUnauthorized: false }
  });

  await transporter.sendMail({
    from: `"${smtpConfig.fromName}" <${smtpConfig.fromEmail || smtpConfig.user}>`,
    to: 'admin@paradigmfms.com',
    subject: `📊 BD Daily Report — Nakul R Alvar | ${reportDateLabel} [Re-sent with Fix]`,
    html
  });

  console.log('✅ Email sent successfully to admin@paradigmfms.com');
}

generateAndSendReport().catch(err => {
  console.error('❌ Failed:', err.message);
  if (err.message.includes('SMTP')) {
    console.log('HINT: Configure SMTP credentials at Admin → Settings → Email Configuration');
  }
});
