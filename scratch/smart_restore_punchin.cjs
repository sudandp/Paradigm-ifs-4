/**
 * SMART RESTORE — Uses yesterday's exact punch-in time per employee
 * Restores only the 47 employees missing punch-in today (2026-07-22)
 * Each employee gets their own yesterday punch-in time cloned to today
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const IST = { timeZone: 'Asia/Kolkata' };
const fmt = (ts) => new Date(ts).toLocaleTimeString('en-IN', { ...IST, hour: '2-digit', minute: '2-digit', hour12: true });

/**
 * Takes yesterday's timestamp and shifts it to today's same time (IST).
 * e.g., yesterday 2026-07-21T04:29:xx UTC (09:59 IST) → 2026-07-22T04:29:xx UTC (09:59 IST today)
 */
function shiftToToday(yesterdayTs) {
  const d = new Date(yesterdayTs);
  // Shift forward exactly 1 day (86400000 ms)
  return new Date(d.getTime() + 86400000).toISOString();
}

async function run() {
  console.log('='.repeat(65));
  console.log('⚡ SMART PUNCH-IN RESTORE — 2026-07-22');
  console.log('   Using yesterday\'s exact time per employee');
  console.log('='.repeat(65));

  const todayStart  = new Date('2026-07-22T00:00:00+05:30').toISOString();
  const todayEnd    = new Date('2026-07-22T23:59:59+05:30').toISOString();
  const yesterStart = new Date('2026-07-21T00:00:00+05:30').toISOString();
  const yesterEnd   = new Date('2026-07-21T23:59:59+05:30').toISOString();

  // ── 1. Who already has punch-in today ──────────────────────
  const { data: todayInEvents } = await supabase
    .from('attendance_events')
    .select('user_id')
    .in('type', ['punch-in', 'check-in'])
    .gte('timestamp', todayStart)
    .lte('timestamp', todayEnd);

  const alreadyHasTodayIn = new Set((todayInEvents || []).map(e => e.user_id));

  // ── 2. Get yesterday's FIRST punch-in per user ──────────────
  const { data: yesterInEvents, error: yErr } = await supabase
    .from('attendance_events')
    .select('user_id, type, timestamp, location_id, latitude, longitude')
    .in('type', ['punch-in', 'check-in'])
    .gte('timestamp', yesterStart)
    .lte('timestamp', yesterEnd)
    .order('timestamp', { ascending: true });

  if (yErr) { console.error('❌ Error fetching yesterday:', yErr.message); return; }

  // Keep first punch-in per user from yesterday
  const yesterFirstIn = {};
  (yesterInEvents || []).forEach(e => {
    if (!yesterFirstIn[e.user_id]) yesterFirstIn[e.user_id] = e;
  });

  // ── 3. Filter to only employees MISSING today's punch-in ────
  const toRestore = Object.values(yesterFirstIn).filter(
    e => !alreadyHasTodayIn.has(e.user_id)
  );

  // ── 4. Fetch their names ─────────────────────────────────────
  const uids = toRestore.map(e => e.user_id);
  const { data: users } = await supabase
    .from('users')
    .select('id, name, role_id')
    .in('id', uids);
  const userMap = Object.fromEntries((users || []).map(u => [u.id, u]));

  console.log(`\n📋 ${toRestore.length} employees to restore:\n`);

  // ── 5. Build insert rows ─────────────────────────────────────
  const insertRows = toRestore.map(e => {
    const u = userMap[e.user_id];
    const restoredTs = shiftToToday(e.timestamp);
    console.log(`  ✅ ${(u?.name || e.user_id).padEnd(35)} [${(u?.role_id || '?').padEnd(20)}] → ${fmt(e.timestamp)} IST (from yesterday)`);
    return {
      user_id:     e.user_id,
      type:        'punch-in',
      timestamp:   restoredTs,
      latitude:    e.latitude  || null,
      longitude:   e.longitude || null,
      location_id: e.location_id || null,
    };
  });

  // ── 6. Insert in batches of 20 ───────────────────────────────
  console.log(`\n⚡ Inserting ${insertRows.length} records into attendance_events...\n`);

  const BATCH = 20;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < insertRows.length; i += BATCH) {
    const batch = insertRows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('attendance_events')
      .insert(batch)
      .select('id, user_id');

    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i/BATCH)+1} failed:`, error.message);
      failCount += batch.length;
    } else {
      successCount += data.length;
      console.log(`  ✅ Batch ${Math.floor(i/BATCH)+1}: inserted ${data.length} records`);
    }
  }

  // ── 7. Final report ──────────────────────────────────────────
  console.log('\n' + '='.repeat(65));
  console.log('📊 RESTORE COMPLETE');
  console.log('='.repeat(65));
  console.log(`  ✅ Successfully restored : ${successCount} punch-in records`);
  if (failCount > 0)
    console.log(`  ❌ Failed               : ${failCount} records`);
  console.log(`  📅 Date restored         : 2026-07-22 IST`);
  console.log(`  🕐 Times used            : Each employee's yesterday punch-in time`);
  console.log('='.repeat(65));
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
