const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
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
const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: t } = await supabase.from('email_templates').select('body_template').eq('id', '50d7d5f8-e777-4a3c-89d1-5f7d29427d5b').single();
  const idx = t.body_template.indexOf('EXECUTIVE SUMMARY');
  console.log(t.body_template.slice(idx - 10, idx + 600));
}
run();
