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
  const { data: leads } = await supabase.from('crm_leads').select('id, client_name, status, created_by, assigned_to');
  console.log('Total leads:', leads?.length);
  const byAssigned = {};
  const byCreated = {};
  leads?.forEach(l => {
    byAssigned[l.assigned_to] = (byAssigned[l.assigned_to] || 0) + 1;
    byCreated[l.created_by] = (byCreated[l.created_by] || 0) + 1;
  });
  console.log('Leads by assigned_to:', byAssigned);
  console.log('Leads by created_by:', byCreated);

  const { data: nakul } = await supabase.from('users').select('id, name, email').ilike('name', '%nakul%').single();
  console.log('Nakul user id:', nakul?.id);

  const nakulLeads = leads?.filter(l => l.assigned_to === nakul?.id || l.created_by === nakul?.id);
  console.log('Nakul leads count:', nakulLeads?.length);
  const nakulStages = {};
  nakulLeads?.forEach(l => nakulStages[l.status] = (nakulStages[l.status] || 0) + 1);
  console.log('Nakul stage distribution:', nakulStages);

  // Check all BD users
  const { data: users } = await supabase.from('users').select('id, name, email, role_id, role:roles(display_name)').eq('is_blocked', false);
  const bds = (users || []).filter(u => {
    const rName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
    const rId = (u.role_id || '').toLowerCase();
    return rName.toLowerCase().includes('business developer') || rId.includes('bd') || rId.includes('business_developer');
  });
  console.log('All BDs:', bds.map(u => ({ id: u.id, name: u.name })));
}
inspect().catch(console.error);
