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
  const { data: u } = await supabase.from('users').select('*').ilike('name', '%Nakul%');
  console.log('Nakul in users:', u);

  const { data: usersWithRoles } = await supabase.from('users').select('id, name, email, role, role_id');
  console.log('Sample users roles:');
  (usersWithRoles || []).forEach(user => {
    if (user.role || (user.role_id && user.role_id.toLowerCase().includes('bd'))) {
      console.log(`- ${user.name}: role=${JSON.stringify(user.role)}, role_id=${user.role_id}`);
    }
  });

  const { data: roles } = await supabase.from('roles').select('*');
  console.log('All roles in DB:', roles);
}
inspect().catch(console.error);
