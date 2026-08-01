const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function findJumps() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  const { data: events } = await supabase
    .from('attendance_events')
    .select('type, timestamp, travel_distance')
    .eq('user_id', nakulId)
    .gte('timestamp', '2026-07-29T18:30:00Z')
    .lt('timestamp', '2026-07-31T18:30:00Z')
    .order('timestamp', { ascending: true });

  console.log('--- 30-31 JUL DETAILED TRAVEL DISTANCE LOGS ---');
  (events || []).forEach(e => {
    const ist = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    console.log(`${ist.toISOString().substring(0, 10)} ${ist.toTimeString().substring(0, 8)} | ${e.type.padEnd(10)} | travel_distance: ${e.travel_distance}`);
  });
}

findJumps();
