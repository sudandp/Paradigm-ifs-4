const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function scanAllBDs() {
  const { data: users } = await supabase.from('users').select('id, name, email');
  
  const startStr = '2026-07-30T18:30:00Z';
  const endStr = '2026-07-31T18:30:00Z';
  
  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .gte('timestamp', startStr)
    .lt('timestamp', endStr);

  console.log('--- ALL USERS DISTANCE SUMS ON 31 JUL IST ---');
  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });

  const grouped = {};
  (events || []).forEach(e => {
    if (!grouped[e.user_id]) grouped[e.user_id] = [];
    grouped[e.user_id].push(e);
  });

  Object.keys(grouped).forEach(uid => {
    const u = userMap[uid] || { name: 'Unknown', email: 'Unknown' };
    const evs = grouped[uid];
    const nonZero = evs.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    const maxVal = nonZero.length > 0 ? Math.max(...nonZero) : 0;
    const sumVal = nonZero.reduce((s, d) => s + d, 0);
    console.log(`User: ${u.name} (${u.email}) | Max: ${maxVal.toFixed(2)} | Sum: ${sumVal.toFixed(2)}`);
  });
}

scanAllBDs();
