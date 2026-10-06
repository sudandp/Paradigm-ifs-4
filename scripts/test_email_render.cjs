const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function testRender() {
  const { data: template, error } = await supabase.from('email_templates').select('*').eq('name', 'Daily Attendance Report').single();
  if (error || !template) {
    console.error('Failed to load template:', error);
    return;
  }

  const sampleUsers = [
    { name: 'Veerabhadra T M', dept: 'Field Ops', pin: '08:42 AM', pout: '05:15 PM', wh: '8h 33m', status: 'Present', color: '#16a34a', bg: '#f0fdf4' },
    { name: 'Dasari Venkatesh', dept: 'HR & Admin', pin: '09:45 AM', pout: '06:30 PM', wh: '8h 45m', status: 'Late', color: '#d97706', bg: '#fffbeb' },
    { name: 'Canny Forest Edge', dept: 'Site Ops', pin: '—', pout: '—', wh: '—', status: 'Absent', color: '#dc2626', bg: '#fef2f2' },
    { name: 'Chennamma', dept: 'Housekeeping', pin: '07:15 AM', pout: '03:45 PM', wh: '8h 30m', status: 'Present', color: '#16a34a', bg: '#f0fdf4' },
    { name: 'Facility Manager VGPT', dept: 'Site Ops', pin: '—', pout: '—', wh: '—', status: 'On Leave', color: '#2563eb', bg: '#eff6ff' },
    { name: 'Basavaraj HB - Senior Manager Landscaping', dept: 'Field Ops', pin: '—', pout: '—', wh: '—', status: 'Absent', color: '#dc2626', bg: '#fef2f2' },
    { name: 'Alekha Behera', dept: 'Plumbing', pin: '—', pout: '—', wh: '—', status: 'Absent', color: '#dc2626', bg: '#fef2f2' },
    { name: 'Arpitha Nairy', dept: 'Security Admin', pin: '—', pout: '—', wh: '—', status: 'Absent', color: '#dc2626', bg: '#fef2f2' },
    { name: 'Balla Yadagiri', dept: 'Field Ops', pin: '—', pout: '—', wh: '—', status: 'Absent', color: '#dc2626', bg: '#fef2f2' },
    { name: 'Soumya Das', dept: 'Technical', pin: '—', pout: '—', wh: '—', status: 'Absent', color: '#dc2626', bg: '#fef2f2' }
  ];

  let tableHtml = '';
  sampleUsers.forEach((u, i) => {
    tableHtml += `<tr style="background:${i%2===0?'#ffffff':'#f8fafc'};border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 10px;text-align:center;color:#64748b;font-size:12px;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${i+1}</td>
      <td style="padding:10px 12px;font-weight:600;color:#0f172a;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${u.name}</td>
      <td style="padding:10px 12px;color:#475569;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${u.dept}</td>
      <td style="padding:10px 10px;text-align:center;color:#0f172a;font-weight:500;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${u.pin}</td>
      <td style="padding:10px 10px;text-align:center;color:#0f172a;font-weight:500;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${u.pout}</td>
      <td style="padding:10px 10px;text-align:center;color:#475569;font-weight:500;white-space:nowrap;border-bottom:1px solid #e2e8f0;">${u.wh}</td>
      <td style="padding:10px 12px;text-align:center;white-space:nowrap;border-bottom:1px solid #e2e8f0;">
        <span style="display:inline-block;padding:3px 10px;font-size:11px;font-weight:700;color:${u.color};background-color:${u.bg};border-radius:12px;border:1px solid ${u.color}40;white-space:nowrap;">${u.status}</span>
      </td>
    </tr>`;
  });

  const replacements = {
    date: 'Sunday, October 4th, 2026',
    generatedTime: '11:49 PM',
    year: '2026',
    totalEmployees: '119',
    totalPresent: '2',
    totalAbsent: '62',
    lateCount: '0',
    attendancePercentage: '2',
    greetingMessage: `Dear Team,<br/><br/>Today's backoffice attendance stands at <strong>2%</strong>. A total of <strong>62</strong> employees were absent, and <strong>0</strong> reported late.<br/><br/>Attendance summary:`,
    table: tableHtml
  };

  let rendered = template.body_template;
  Object.keys(replacements).forEach(k => {
    rendered = rendered.replace(new RegExp(`{${k}}`, 'gi'), replacements[k]);
  });

  const outPath = path.join(__dirname, 'test_rendered_email.html');
  fs.writeFileSync(outPath, rendered, 'utf8');
  console.log(`Rendered email saved to: ${outPath}`);
}

testRender();
