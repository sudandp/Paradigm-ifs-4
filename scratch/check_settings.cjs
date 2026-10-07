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

async function check() {
  const { data: s } = await supabase.from('settings').select('*');
  console.log('Settings rows:', s);

  // Check email_templates table for 'CRM BD Daily Report'
  const { data: tmpls } = await supabase.from('email_templates').select('id, name, subject_template, body_template, variables').ilike('name', '%bd%');
  console.log('BD templates in DB:', tmpls?.map(t => ({ id: t.id, name: t.name, variables: t.variables?.map(v => v.key) })));
  if (tmpls && tmpls[0]) {
    console.log('Template ID:', tmpls[0].id);
  }
}
check().catch(console.error);
