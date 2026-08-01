const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function findReportData() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', nakulId)
    .order('timestamp', { ascending: false })
    .limit(100);

  // Let's group events by day (IST) and show the counts, max distance, sum of distance
  const daily = {};
  (events || []).forEach(e => {
    const d = new Date(new Date(e.timestamp).getTime() + 5.5 * 3600000);
    const dateStr = d.toISOString().substring(0, 10);
    if (!daily[dateStr]) daily[dateStr] = [];
    daily[dateStr].push(e);
  });

  console.log('=== DAILY STATS (LAST 10 DAYS) ===');
  Object.keys(daily).sort().reverse().slice(0, 10).forEach(dateStr => {
    const evs = daily[dateStr].reverse();
    const nonZero = evs.map(e => Number(e.travel_distance || 0)).filter(d => d > 0);
    const maxVal = nonZero.length > 0 ? Math.max(...nonZero) : 0;
    const sumVal = nonZero.reduce((s, d) => s + d, 0);
    console.log(`Date: ${dateStr} | Events: ${evs.length} | Max: ${maxVal.toFixed(2)} | Sum: ${sumVal.toFixed(2)}`);
  });
}

findReportData();
