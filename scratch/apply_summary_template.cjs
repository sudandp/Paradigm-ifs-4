const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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

async function run() {
  const { data: templates } = await supabase.from('email_templates').select('id, name, body_template').ilike('name', '%BD%');
  console.log(`Found ${templates?.length} BD templates.`);

  const summaryBlock = `  <!-- EXECUTIVE SUMMARY -->
  <tr>
    <td class="section-box" style="background:#ffffff;padding:18px 24px 0;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:8px;">
        <tr>
          <td style="padding:14px 18px;">
            <div style="font-size:10px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Daily Summary</div>
            <div style="font-size:13px;color:#1e293b;line-height:1.6;font-weight:500;">
              {mail_summary}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

  for (const t of (templates || [])) {
    let body = t.body_template;
    if (body.includes('{mail_summary}')) {
      console.log(`Template ${t.name} (${t.id}) already has {mail_summary}.`);
      continue;
    }

    // Insert right after the HEADER closing </tr>
    const headerEndIdx = body.indexOf('<!-- SECTION 1: ATTENDANCE');
    if (headerEndIdx !== -1) {
      body = body.slice(0, headerEndIdx) + summaryBlock + '\n  ' + body.slice(headerEndIdx);
      const { error } = await supabase.from('email_templates').update({ body_template: body }).eq('id', t.id);
      if (error) {
        console.error(`Error updating template ${t.id}:`, error);
      } else {
        console.log(`Successfully updated template ${t.name} (${t.id}) with Executive Summary!`);
      }
    } else {
      console.warn(`Could not find insertion marker in template ${t.name}`);
    }
  }
}

run().catch(console.error);
