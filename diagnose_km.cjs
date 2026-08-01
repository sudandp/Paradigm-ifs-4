const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function diagnose() {
  const { data: events } = await supabase
    .from('attendance_events')
    .select('id, type, timestamp, travel_distance, latitude, longitude')
    .eq('user_id', '84d4ee16-b60f-401c-9478-584b7cbea26d')
    .gte('timestamp', '2026-07-30T18:30:00Z')
    .lt('timestamp', '2026-07-31T18:30:00Z')
    .order('timestamp', { ascending: true });

  console.log('Total events on 31 Jul IST:', events ? events.length : 0);
  console.log('\n=== ALL EVENTS IN ORDER ===');
  (events || []).forEach((e, i) => {
    const ist = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    console.log(`[${i+1}] ${e.type.padEnd(12)} | ${ist.toTimeString().substring(0,8)} IST | travel_distance: ${e.travel_distance}`);
  });

  // Identify sessions (punch-in to punch-out)
  console.log('\n=== SESSION ANALYSIS ===');
  let sessionNum = 0;
  let sessionStart = null;
  let sessionDistances = [];
  
  (events || []).forEach((e, i) => {
    if (e.type === 'punch-in') {
      sessionNum++;
      sessionStart = e;
      sessionDistances = [];
      console.log(`\n--- Session ${sessionNum} START ---`);
    }
    
    if (e.travel_distance > 0) {
      sessionDistances.push(Number(e.travel_distance));
    }
    
    const ist = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    console.log(`  ${e.type.padEnd(12)} ${ist.toTimeString().substring(0,8)} | travel_dist: ${e.travel_distance}`);
    
    if (e.type === 'punch-out') {
      const sessionMax = sessionDistances.length > 0 ? Math.max(...sessionDistances) : 0;
      console.log(`--- Session ${sessionNum} END | Max in session: ${sessionMax.toFixed(2)} km ---`);
    }
  });

  // Correct calculation: sum of MAX per session
  console.log('\n=== CORRECT KM CALCULATION ===');
  let sessions = [];
  let curSession = [];
  
  (events || []).forEach(e => {
    if (e.type === 'punch-in') {
      if (curSession.length > 0) sessions.push(curSession);
      curSession = [e];
    } else {
      curSession.push(e);
    }
  });
  if (curSession.length > 0) sessions.push(curSession);
  
  let totalKm = 0;
  sessions.forEach((sess, i) => {
    const dists = sess.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    const sessMax = dists.length > 0 ? Math.max(...dists) : 0;
    console.log(`Session ${i+1}: max travel_distance = ${sessMax.toFixed(2)} km`);
    totalKm += sessMax;
  });
  
  console.log(`\nTOTAL (sum of session MAXes): ${totalKm.toFixed(2)} km`);
  console.log(`Old wrong (global MAX):       ${Math.max(...(events || []).map(e => Number(e.travel_distance || 0)).filter(d => d > 0), 0).toFixed(2)} km`);
  console.log(`Old wrong (naive SUM):        ${(events || []).reduce((s, e) => s + Number(e.travel_distance || 0), 0).toFixed(2)} km`);
  console.log(`Expected:                     77.28 km`);
}

diagnose();
