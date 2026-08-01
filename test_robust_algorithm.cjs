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

function calculateDailyTravelKmRobust(events) {
  if (!events || events.length === 0) return 0;
  
  // Group events by session (separated by punch-in)
  const sessions = [];
  let curSession = [];
  
  // Sort events chronologically
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  sortedEvents.forEach(e => {
    if (e.type === 'punch-in') {
      if (curSession.length > 0) {
        sessions.push(curSession);
      }
      curSession = [e];
    } else {
      curSession.push(e);
    }
  });
  if (curSession.length > 0) {
    sessions.push(curSession);
  }
  
  let totalDailyKm = 0;
  
  sessions.forEach((sess, idx) => {
    // 1. Calculate device distance (Max - Min in session)
    const deviceValues = sess.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    let deviceDist = 0;
    if (deviceValues.length > 0) {
      const maxVal = Math.max(...deviceValues);
      const minVal = Math.min(...deviceValues);
      deviceDist = maxVal - minVal;
      
      // Special case: if there's only 1 reading, we treat it as starting from 0 if it's small,
      // or if it's large and we don't have a baseline, we reject it as a jump.
      if (deviceValues.length === 1) {
        deviceDist = deviceValues[0] > 50 ? 0 : deviceValues[0];
      }
    }
    
    // 2. Calculate haversine distance
    let haversineDist = 0;
    let prev = null;
    sess.forEach(e => {
      if (prev && prev.latitude && prev.longitude && e.latitude && e.longitude) {
        haversineDist += getDistance(prev.latitude, prev.longitude, e.latitude, e.longitude);
      }
      prev = e;
    });
    
    // 3. Robust combination
    let sessionKm = 0;
    if (deviceDist > 0) {
      // If device says they traveled more than 200km but haversine is under 20km,
      // it's almost certainly a GPS coordinate background jump error on the device.
      if (deviceDist > 100 && haversineDist < 30) {
        console.log(`  Session ${idx+1}: Rejected device jump (${deviceDist.toFixed(2)} km) using Haversine (${haversineDist.toFixed(2)} km) instead.`);
        sessionKm = haversineDist;
      } else {
        // Use device distance if it's larger (winding path), otherwise use haversine (stale device distance)
        sessionKm = Math.max(deviceDist, haversineDist);
      }
    } else {
      sessionKm = haversineDist;
    }
    
    console.log(`  Session ${idx+1}: Device Delta: ${deviceDist.toFixed(2)} km | Haversine: ${haversineDist.toFixed(2)} km | Chosen: ${sessionKm.toFixed(2)} km`);
    totalDailyKm += sessionKm;
  });
  
  return Number(totalDailyKm.toFixed(2));
}

async function testAlgorithm() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  
  console.log('--- TESTING ROBUST ALGORITHM FOR 31 JUL 2026 ---');
  const { data: events31 } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', nakulId)
    .gte('timestamp', '2026-07-30T18:30:00Z')
    .lt('timestamp', '2026-07-31T18:30:00Z');
  
  const km31 = calculateDailyTravelKmRobust(events31 || []);
  console.log(`TOTAL CALCULATED FOR 31 JUL: ${km31} km`);

  console.log('\n--- TESTING ROBUST ALGORITHM FOR 30 JUL 2026 ---');
  const { data: events30 } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', nakulId)
    .gte('timestamp', '2026-07-29T18:30:00Z')
    .lt('timestamp', '2026-07-30T18:30:00Z');
  
  const km30 = calculateDailyTravelKmRobust(events30 || []);
  console.log(`TOTAL CALCULATED FOR 30 JUL: ${km30} km`);
}

testAlgorithm();
