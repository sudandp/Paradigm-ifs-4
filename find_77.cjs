const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function find77() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', nakulId)
    .order('timestamp', { ascending: false });

  console.log('Total events:', events ? events.length : 0);

  const daily = {};
  (events || []).forEach(e => {
    const d = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    const dateStr = d.toISOString().substring(0, 10);
    if (!daily[dateStr]) daily[dateStr] = [];
    daily[dateStr].push(e);
  });

  Object.keys(daily).forEach(dateStr => {
    const evs = daily[dateStr];
    const nonZero = evs.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    const maxVal = nonZero.length > 0 ? Math.max(...nonZero) : 0;
    const sumVal = nonZero.reduce((s, d) => s + d, 0);

    // Let's also calculate haversine distance for that day
    let haversine = 0;
    let prev = null;
    const sorted = [...evs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    sorted.forEach(e => {
      if (prev && prev.latitude && prev.longitude && e.latitude && e.longitude) {
        const toRad = (d) => (d * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(Number(e.latitude) - Number(prev.latitude));
        const dLon = toRad(Number(e.longitude) - Number(prev.longitude));
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(toRad(Number(prev.latitude))) * Math.cos(toRad(Number(e.latitude))) * Math.sin(dLon / 2) ** 2;
        haversine += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }
      prev = e;
    });

    console.log(`Date: ${dateStr} | Max: ${maxVal.toFixed(2)} km | Sum: ${sumVal.toFixed(2)} km | Haversine: ${haversine.toFixed(2)} km`);
  });
}

find77();
