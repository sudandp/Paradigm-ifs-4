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
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';

  // Get YESTERDAY events (31 Jul IST)
  const { data: todayEvents } = await supabase
    .from('attendance_events')
    .select('id, type, timestamp, travel_distance')
    .eq('user_id', nakulId)
    .gte('timestamp', '2026-07-30T18:30:00Z')
    .lt('timestamp', '2026-07-31T18:30:00Z')
    .order('timestamp', { ascending: true });

  // Get DAY BEFORE events (30 Jul IST)
  const { data: prevEvents } = await supabase
    .from('attendance_events')
    .select('id, type, timestamp, travel_distance')
    .eq('user_id', nakulId)
    .gte('timestamp', '2026-07-29T18:30:00Z')
    .lt('timestamp', '2026-07-30T18:30:00Z')
    .order('timestamp', { ascending: true });

  // Also get last 5 events BEFORE the start of 31 Jul window (the most recent reading before today)
  const { data: priorEvents } = await supabase
    .from('attendance_events')
    .select('id, type, timestamp, travel_distance')
    .eq('user_id', nakulId)
    .lt('timestamp', '2026-07-30T18:30:00Z')
    .not('travel_distance', 'is', null)
    .gt('travel_distance', 0)
    .order('timestamp', { ascending: false })
    .limit(5);

  console.log('=== 30 Jul 2026 Events (IST) ===');
  (prevEvents || []).forEach(e => {
    const ist = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    console.log(`  ${e.type.padEnd(12)} ${ist.toTimeString().substring(0,8)} | travel_dist: ${e.travel_distance}`);
  });

  console.log('\n=== 31 Jul 2026 Events (IST) ===');
  (todayEvents || []).forEach(e => {
    const ist = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    console.log(`  ${e.type.padEnd(12)} ${ist.toTimeString().substring(0,8)} | travel_dist: ${e.travel_distance}`);
  });

  // Find baseline: last non-null travel_distance BEFORE this day's window
  const priorDist = (priorEvents || []).find(e => e.travel_distance > 0);
  const baselineKm = priorDist ? Number(priorDist.travel_distance) : 0;
  
  console.log('\n=== Last 5 Non-null travel_distance Events BEFORE 31 Jul ===');
  (priorEvents || []).forEach(e => {
    const ist = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    console.log(`  ${e.type.padEnd(12)} ${ist.toISOString().substring(0,10)} | travel_dist: ${e.travel_distance}`);
  });

  const todayDistances = (todayEvents || []).map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
  const todayMax = todayDistances.length > 0 ? Math.max(...todayDistances) : 0;

  console.log('\n=== KM CALCULATION METHODS ===');
  console.log('Baseline (last value before this day):', baselineKm.toFixed(2), 'km');
  console.log('Today MAX travel_distance:            ', todayMax.toFixed(2), 'km');
  console.log('DELTA (today max - baseline):         ', (todayMax - baselineKm).toFixed(2), 'km  ← try this');
  console.log('Expected from user report:             77.28 km');
}

diagnose();
