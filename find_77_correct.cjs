const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function find77Correct() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', nakulId)
    .order('timestamp', { ascending: false });

  const daily = {};
  (events || []).forEach(e => {
    const d = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    const dateStr = d.toISOString().substring(0, 10);
    if (!daily[dateStr]) daily[dateStr] = [];
    daily[dateStr].push(e);
  });

  console.log('--- CORRECTED HA VERSINE DAILY COMPARISON ---');
  Object.keys(daily).sort().reverse().slice(0, 15).forEach(dateStr => {
    const evs = daily[dateStr];
    const nonZero = evs.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    const maxVal = nonZero.length > 0 ? Math.max(...nonZero) : 0;
    const sumVal = nonZero.reduce((s, d) => s + d, 0);

    let haversine = 0;
    let prev = null; // RESET PER DATE
    const sorted = [...evs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    sorted.forEach(e => {
      if (prev && prev.latitude && prev.longitude && e.latitude && e.longitude) {
        haversine += getDistance(prev.latitude, prev.longitude, e.latitude, e.longitude);
      }
      prev = e;
    });

    console.log(`Date: ${dateStr} | Max travel_dist: ${maxVal.toFixed(2)} km | Sum travel_dist: ${sumVal.toFixed(2)} km | Haversine: ${haversine.toFixed(2)} km`);
  });
}

find77Correct();
