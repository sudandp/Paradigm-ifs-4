const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(l => {
  const idx = l.indexOf('=');
  if (idx > -1) {
    const k = l.slice(0, idx).trim();
    let v = l.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function inspectHtml() {
  const { data: rule } = await supabase.from('email_schedule_rules').select('*, template:email_templates(*)').eq('id', '1c3dd098-1423-4a91-a5fa-6451dff6494d').single();
  const template = rule.template;
  console.log('Template ID:', template?.id);
  console.log('Template Body Start:');
  console.log(template?.body_template?.slice(0, 500));
  fs.writeFileSync('scratch/db_template_dump.html', template?.body_template || '');
}
inspectHtml().catch(console.error);
