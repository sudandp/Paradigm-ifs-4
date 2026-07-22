/**
 * CHECK: How many events exist today BEFORE and AFTER the deletion
 * This tells us: what types of events still exist today
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function run() {
  // Today's full day in UTC (IST is +5:30)
  const start = '2026-07-22T00:00:00+05:30';
  const end   = '2026-07-22T23:59:59+05:30';

  // 1. All events today — grouped by type
  const { data: allEvents, error } = await supabase
    .from('attendance_events')
    .select('id, type, user_id, timestamp')
    .gte('timestamp', new Date(start).toISOString())
    .lte('timestamp', new Date(end).toISOString())
    .order('timestamp', { ascending: true });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  // Group by type
  const byType = {};
  allEvents.forEach(e => {
    byType[e.type] = (byType[e.type] || 0) + 1;
  });

  console.log('='.repeat(60));
  console.log('TODAY\'S EVENTS STILL IN DB (2026-07-22 IST)');
  console.log('='.repeat(60));
  console.log(`Total events remaining today: ${allEvents.length}`);
  console.log('\nBreakdown by type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type.padEnd(25)} → ${count} events`);
  });

  // 2. Unique users who have ANY event today
  const usersWithEvents = new Set(allEvents.map(e => e.user_id));
  console.log(`\nUnique employees with at least 1 event today: ${usersWithEvents.size}`);

  // 3. Unique users with punch-out (check-out) but NO punch-in
  const punchInUsers = new Set(
    allEvents.filter(e => ['punch-in', 'check-in'].includes(e.type)).map(e => e.user_id)
  );
  const punchOutUsers = new Set(
    allEvents.filter(e => ['punch-out', 'check-out'].includes(e.type)).map(e => e.user_id)
  );

  const hasOutButNoIn = [...punchOutUsers].filter(id => !punchInUsers.has(id));
  console.log(`\n⚠️  Employees with punch-OUT but MISSING punch-IN: ${hasOutButNoIn.length}`);
  console.log('  (These are the most critical ones to restore)\n');

  if (hasOutButNoIn.length > 0) {
    // Get their punch-out times to estimate punch-in time
    const outEvents = allEvents.filter(
      e => hasOutButNoIn.includes(e.user_id) && ['punch-out', 'check-out'].includes(e.type)
    );

    // Fetch user names
    const { data: users } = await supabase
      .from('users')
      .select('id, name, role_id')
      .in('id', hasOutButNoIn);

    const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

    console.log('Users with punch-out but no punch-in:');
    hasOutButNoIn.forEach(uid => {
      const u = userMap[uid];
      const outEvt = outEvents.find(e => e.user_id === uid);
      const outTime = outEvt
        ? new Date(outEvt.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
        : '?';
      console.log(`  - ${u?.name || uid} [${u?.role_id}] → punched out at ${outTime} IST`);
    });
  }

  // 4. Show earliest events today (what's the first event timestamp?)
  if (allEvents.length > 0) {
    const first = allEvents[0];
    const last = allEvents[allEvents.length - 1];
    console.log(`\nEarliest event today: ${new Date(first.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST [${first.type}]`);
    console.log(`Latest event today:   ${new Date(last.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST [${last.type}]`);
  }
}

run();
