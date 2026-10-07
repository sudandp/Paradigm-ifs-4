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
  const { data: t } = await supabase.from('email_templates').select('*').eq('id', '50d7d5f8-e777-4a3c-89d1-5f7d29427d5b').single();
  console.log('Template Name:', t?.name);
  console.log('Template Subject:', t?.subject_template);
  console.log('Body length:', t?.body_template?.length);
  fs.writeFileSync('scratch/current_bd_template.html', t?.body_template || '', 'utf-8');
  console.log('Saved to scratch/current_bd_template.html');
}
inspect().catch(console.error);
