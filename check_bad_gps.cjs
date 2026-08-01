const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function checkBadGPS() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', nakulId)
    .gte('timestamp', '2026-07-23T18:30:00Z')
    .lt('timestamp', '2026-07-24T18:30:00Z')
    .order('timestamp', { ascending: true });

  console.log('Events on 24 Jul:');
  (events || []).forEach(e => {
    console.log(`Type: ${e.type} | Lat: ${e.latitude} | Lon: ${e.longitude} | travel_distance: ${e.travel_distance}`);
  });
}

checkBadGPS();
