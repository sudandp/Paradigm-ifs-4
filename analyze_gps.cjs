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

async function analyzeGPS() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', nakulId)
    .gte('timestamp', '2026-07-30T18:30:00Z')
    .lt('timestamp', '2026-07-31T18:30:00Z')
    .order('timestamp', { ascending: true });

  console.log('=== GPS PATH ANALYSIS ===');
  let prev = null;
  let totalCalculated = 0;
  (events || []).forEach((e, i) => {
    const ist = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    let distFromPrev = 0;
    if (prev && prev.latitude && prev.longitude && e.latitude && e.longitude) {
      distFromPrev = getDistance(prev.latitude, prev.longitude, e.latitude, e.longitude);
      totalCalculated += distFromPrev;
    }
    console.log(`[${i+1}] ${e.type.padEnd(10)} | ${ist.toTimeString().substring(0,8)} | Lat: ${e.latitude}, Lon: ${e.longitude} | travel_distance: ${e.travel_distance} | Calculated Step: ${distFromPrev.toFixed(2)} km`);
    prev = e;
  });

  console.log(`\nTotal Calculated GPS Haversine distance: ${totalCalculated.toFixed(2)} km`);
}

analyzeGPS();
