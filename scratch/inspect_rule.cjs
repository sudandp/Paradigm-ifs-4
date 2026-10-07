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

async function inspect() {
  const { data: rule } = await supabase.from('email_schedule_rules').select('*, template:email_templates(*)').eq('id', '1c3dd098-1423-4a91-a5fa-6451dff6494d').single();
  console.log('Rule Name:', rule.name);
  console.log('Report Type:', rule.report_type);
  console.log('Template Name:', rule.template?.name);
  console.log('Template Subject:', rule.template?.subject_template);
}
inspect().catch(console.error);
