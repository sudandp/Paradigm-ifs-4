const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function find77Global() {
  const { data: events } = await supabase
    .from('attendance_events')
    .select('user_id, type, timestamp, travel_distance')
    .not('travel_distance', 'is', null)
    .gt('travel_distance', 0)
    .order('timestamp', { ascending: false });

  console.log('Total events with distance:', events ? events.length : 0);

  const matched = [];
  (events || []).forEach(e => {
    if (Math.abs(Number(e.travel_distance) - 77.28) < 1.0) {
      matched.push(e);
    }
  });

  console.log('Events near 77.28:');
  console.log(matched);
}

find77Global();
