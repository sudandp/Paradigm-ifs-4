const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function findExact77() {
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

  console.log('--- SCANNING ALL DATES FOR NAKUL FOR VALUE 77.28 ---');
  Object.keys(daily).sort().reverse().forEach(dateStr => {
    const evs = daily[dateStr];
    const nonZero = evs.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    const sum = nonZero.reduce((s, d) => s + d, 0);
    const max = nonZero.length > 0 ? Math.max(...nonZero) : 0;
    
    // check each event individual value
    const matchingEvents = evs.filter(e => Math.abs(Number(e.travel_distance) - 77.28) < 0.5);
    
    if (Math.abs(sum - 77.28) < 2.0 || Math.abs(max - 77.28) < 2.0 || matchingEvents.length > 0) {
      console.log(`Match on ${dateStr}:`);
      console.log(`  Sum: ${sum.toFixed(2)} km`);
      console.log(`  Max: ${max.toFixed(2)} km`);
      console.log(`  Matching Events:`, matchingEvents.map(e => ({ type: e.type, dist: e.travel_distance })));
    }
  });
}

findExact77();
