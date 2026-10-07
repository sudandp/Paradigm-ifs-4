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
  const { data: u } = await supabase.from('users').select('id, name, email, role_id, role, department').ilike('name', '%Nakul%');
  console.log('Nakul:', u);

  const { data: bds } = await supabase.from('users').select('id, name, email, role_id, role, department').or('role_id.ilike.%bd%,role_id.ilike.%business%,department.ilike.%bd%,department.ilike.%business%');
  console.log('BD Users matching filter:', bds);

  // Also check all distinct role_ids and departments in users table
  const { data: allUsers } = await supabase.from('users').select('role_id, department');
  const distinctRoles = new Set();
  const distinctDepts = new Set();
  (allUsers || []).forEach(x => {
    if (x.role_id) distinctRoles.add(x.role_id);
    if (x.department) distinctDepts.add(x.department);
  });
  console.log('Distinct role_ids in users:', [...distinctRoles]);
  console.log('Distinct departments in users:', [...distinctDepts]);
}
inspect().catch(console.error);
