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

async function checkPravin() {
  const { data: pravin } = await supabase.from('users').select('*').ilike('name', '%pravin%').single();
  console.log('Pravin:', pravin?.id, pravin?.name);

  const start = '2026-10-06T00:00:00+05:30';
  const end = '2026-10-06T23:59:59+05:30';
  const { data: evts } = await supabase.from('attendance_events')
    .select('type, timestamp, location_name, travel_distance')
    .eq('user_id', pravin?.id)
    .gte('timestamp', new Date(start).toISOString())
    .lte('timestamp', new Date(end).toISOString())
    .order('timestamp', { ascending: true });

  console.log(`Pravin attendance events on Oct 06 (${evts?.length}):`, evts);

  const { data: leads } = await supabase.from('crm_leads')
    .select('id, client_name, status')
    .or(`created_by.eq.${pravin?.id},assigned_to.eq.${pravin?.id}`);
  console.log(`Pravin leads (${leads?.length}):`, leads);

  const { data: followups } = await supabase.from('crm_followups')
    .select('id, type, outcome')
    .eq('created_by', pravin?.id);
  console.log(`Pravin followups (${followups?.length}):`, followups);
}
checkPravin().catch(console.error);
