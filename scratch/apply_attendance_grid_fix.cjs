const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const newSection1Html = `<!-- SECTION 1: ATTENDANCE & TIME -->
  <tr>
    <td class="section-box" style="background:#ffffff;padding:18px 24px;">
      <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #f1f5f9;">1. Attendance &amp; Time</div>
      
      <!-- ROW 1: Status, Check In, Check Out (3 cards) -->
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:4px 0;table-layout:fixed;margin-bottom:6px;">
        <tr>
          <td class="top-card-cell" style="background:{status_bg};border:1px solid {status_border};border-radius:8px;padding:9px 6px;text-align:center;width:33.33%;">
            <div class="top-card-lbl" style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Status</div>
            <div class="top-card-val" style="font-size:13px;font-weight:800;color:{status_color};margin-top:3px;white-space:nowrap;">{attendance_status}</div>
          </td>
          <td class="top-card-cell" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 6px;text-align:center;width:33.33%;">
            <div class="top-card-lbl" style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Check In</div>
            <div class="top-card-val" style="font-size:13px;font-weight:700;color:#1e293b;margin-top:3px;white-space:nowrap;">{check_in_time}</div>
          </td>
          <td class="top-card-cell" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:9px 6px;text-align:center;width:33.33%;">
            <div class="top-card-lbl" style="font-size:9px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Check Out</div>
            <div class="top-card-val" style="font-size:13px;font-weight:700;color:#1e293b;margin-top:3px;white-space:nowrap;">{check_out_time}</div>
          </td>
        </tr>
      </table>

      <!-- ROW 2: Work Hours, Travelled (2 cards) -->
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:4px 0;table-layout:fixed;">
        <tr>
          <td class="top-card-cell" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:9px 8px;text-align:center;width:50%;">
            <div class="top-card-lbl" style="font-size:9px;color:#1d4ed8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Work Hours</div>
            <div class="top-card-val" style="font-size:13px;font-weight:800;color:#1d4ed8;margin-top:3px;white-space:nowrap;">{working_hours}</div>
          </td>
          <td class="top-card-cell" style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:9px 8px;text-align:center;width:50%;">
            <div class="top-card-lbl" style="font-size:9px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Travelled</div>
            <div class="top-card-val" style="font-size:13px;font-weight:800;color:#d97706;margin-top:3px;white-space:nowrap;">{kms_travelled}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;

async function updateTemplates() {
  const { data: templates, error } = await supabase.from('email_templates').select('id, name, body_template');
  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  const bdTemplates = templates.filter(t => (t.name || '').toLowerCase().includes('bd'));
  console.log(`Found ${bdTemplates.length} BD templates to update.`);

  for (const t of bdTemplates) {
    let html = t.body_template || '';

    // Replace old Section 1
    const sec1Regex = /<!-- SECTION 1: ATTENDANCE & TIME -->[\s\S]*?<!-- SECTION 2: ACTIVITY SUMMARY -->/;
    if (sec1Regex.test(html)) {
      html = html.replace(sec1Regex, `${newSection1Html}\n\n  <!-- SECTION 2: ACTIVITY SUMMARY -->`);
      
      // Ensure align="left" and margin:0 0 24px 0 on main table
      html = html.replace(/<table([^>]*?)align=["']?center["']?/gi, '<table$1align="left"')
                 .replace(/margin:\s*0\s+auto;/gi, 'margin:0 0 24px 0;');

      const { error: upErr } = await supabase
        .from('email_templates')
        .update({ body_template: html, updated_at: new Date().toISOString() })
        .eq('id', t.id);

      if (upErr) {
        console.error(`Failed to update ${t.name} (${t.id}):`, upErr);
      } else {
        console.log(`Successfully updated Section 1 in template: ${t.name} (${t.id})`);
      }
    } else {
      console.warn(`Section 1 marker not found in template ${t.name} (${t.id})`);
    }
  }
}

updateTemplates();
