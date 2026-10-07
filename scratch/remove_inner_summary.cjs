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
  for (const t of (templates || [])) {
    let body = t.body_template;
    const startIdx = body.indexOf('<!-- EXECUTIVE SUMMARY -->');
    if (startIdx !== -1) {
      const endMarker = '<!-- SECTION 1: ATTENDANCE';
      const endIdx = body.indexOf(endMarker);
      if (endIdx !== -1) {
        body = body.slice(0, startIdx) + body.slice(endIdx);
        await supabase.from('email_templates').update({ body_template: body }).eq('id', t.id);
        console.log(`Cleaned inner summary from template ${t.name} (${t.id})`);
      }
    }
  }
}

run().catch(console.error);
