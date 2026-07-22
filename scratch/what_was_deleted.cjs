/**
 * WHAT WAS DELETED TODAY — 2026-07-22
 * Shows exactly which employees are missing punch-in/punch-out
 * by cross-referencing with all users who have ANY event today
 * and users who punched yesterday.
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

async function run() {
  const todayStart   = new Date('2026-07-22T00:00:00+05:30').toISOString();
  const todayEnd     = new Date('2026-07-22T23:59:59+05:30').toISOString();
  const yesterStart  = new Date('2026-07-21T00:00:00+05:30').toISOString();
  const yesterEnd    = new Date('2026-07-21T23:59:59+05:30').toISOString();

  // ── Fetch all events today ──────────────────────────────────
  const { data: todayEvents } = await supabase
    .from('attendance_events')
    .select('id, user_id, type, timestamp')
    .gte('timestamp', todayStart)
    .lte('timestamp', todayEnd)
    .order('timestamp', { ascending: true });

  // ── Fetch all events yesterday ──────────────────────────────
  const { data: yesterEvents } = await supabase
    .from('attendance_events')
    .select('user_id, type, timestamp')
    .gte('timestamp', yesterStart)
    .lte('timestamp', yesterEnd);

  // ── Fetch all users (non-admin) ─────────────────────────────
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, role_id, organization_name')
    .not('role_id', 'in', '("unverified","admin","super_admin","kiosk")');

  const userMap = Object.fromEntries((allUsers || []).map(u => [u.id, u]));

  // ── Build sets ──────────────────────────────────────────────
  const todayPunchIn  = new Set(todayEvents.filter(e => ['punch-in','check-in'].includes(e.type)).map(e => e.user_id));
  const todayPunchOut = new Set(todayEvents.filter(e => ['punch-out','check-out'].includes(e.type)).map(e => e.user_id));
  const todayAnyEvent = new Set(todayEvents.map(e => e.user_id));

  const yesterPunchIn  = new Set(yesterEvents.filter(e => ['punch-in','check-in'].includes(e.type)).map(e => e.user_id));
  const yesterPunchOut = new Set(yesterEvents.filter(e => ['punch-out','check-out'].includes(e.type)).map(e => e.user_id));

  // Yesterday's punch-in times per user
  const yesterInTime = {};
  yesterEvents
    .filter(e => ['punch-in','check-in'].includes(e.type))
    .forEach(e => {
      if (!yesterInTime[e.user_id]) yesterInTime[e.user_id] = e.timestamp;
    });

  // Yesterday's punch-out times per user
  const yesterOutTime = {};
  yesterEvents
    .filter(e => ['punch-out','check-out'].includes(e.type))
    .forEach(e => {
      // keep last punch-out
      yesterOutTime[e.user_id] = e.timestamp;
    });

  // Today's existing punch-in time per user
  const todayInTime = {};
  todayEvents
    .filter(e => ['punch-in','check-in'].includes(e.type))
    .forEach(e => {
      if (!todayInTime[e.user_id]) todayInTime[e.user_id] = e.timestamp;
    });

  console.log('='.repeat(70));
  console.log('📋  DELETED RECORDS REPORT — 2026-07-22 IST');
  console.log('='.repeat(70));
  console.log(`Total events remaining today   : ${todayEvents.length}`);
  console.log(`Employees with punch-in today  : ${todayPunchIn.size}`);
  console.log(`Employees with punch-out today : ${todayPunchOut.size}`);
  console.log(`Employees punched in yesterday : ${yesterPunchIn.size}`);
  console.log('');

  // ── CATEGORY 1: Punched yesterday, NO punch-in today ────────
  // These are the primary deleted records
  const missingInFromYest = [...yesterPunchIn].filter(uid => !todayPunchIn.has(uid));

  console.log('─'.repeat(70));
  console.log(`🔴  CATEGORY 1 — Punched yesterday but MISSING punch-in today`);
  console.log(`    Count: ${missingInFromYest.length} employees`);
  console.log(`    Status: These are the DELETED punch-in records to restore`);
  console.log('─'.repeat(70));
  missingInFromYest.forEach((uid, i) => {
    const u = userMap[uid] || { name: uid, role_id: '?' };
    const yIn  = yesterInTime[uid]  ? fmt(yesterInTime[uid])  : 'N/A';
    const yOut = yesterOutTime[uid] ? fmt(yesterOutTime[uid]) : 'N/A';
    const hasTodayEvent = todayAnyEvent.has(uid) ? '(has other events today)' : '(no events at all today)';
    console.log(`  ${String(i+1).padStart(3)}. ${u.name}`);
    console.log(`       Role: ${u.role_id} | Org: ${u.organization_name || 'N/A'}`);
    console.log(`       Yesterday: punch-in ${yIn} → punch-out ${yOut}`);
    console.log(`       Today: punch-in MISSING ${hasTodayEvent}`);
    console.log(`       User ID: ${uid}`);
    console.log('');
  });

  // ── CATEGORY 2: Have punch-in today but no punch-out ────────
  const missingOut = [...todayPunchIn].filter(uid => !todayPunchOut.has(uid));
  const missingOutFromYest = missingOut.filter(uid => yesterPunchOut.has(uid));

  console.log('─'.repeat(70));
  console.log(`🟡  CATEGORY 2 — Have punch-in today but MISSING punch-out`);
  console.log(`    Count: ${missingOut.length} employees (${missingOutFromYest.length} had punch-out yesterday)`);
  console.log(`    Status: Punch-out may have been deleted OR they haven't left yet`);
  console.log('─'.repeat(70));
  missingOut.forEach((uid, i) => {
    const u = userMap[uid] || { name: uid, role_id: '?' };
    const tIn  = todayInTime[uid]   ? fmt(todayInTime[uid])   : 'N/A';
    const yOut = yesterOutTime[uid] ? fmt(yesterOutTime[uid]) : 'N/A';
    const hadYestOut = yesterPunchOut.has(uid) ? `yesterday out: ${yOut}` : 'no punch-out yesterday either';
    console.log(`  ${String(i+1).padStart(3)}. ${u.name} [${u.role_id}] | punched in today: ${tIn} IST | ${hadYestOut}`);
  });

  // ── CATEGORY 3: Had nothing yesterday and nothing today ──────
  const neverPunched = (allUsers || []).filter(u =>
    !yesterPunchIn.has(u.id) &&
    !todayPunchIn.has(u.id) &&
    !todayAnyEvent.has(u.id)
  );

  console.log('\n' + '─'.repeat(70));
  console.log(`⚪  CATEGORY 3 — No attendance yesterday OR today (likely inactive)`);
  console.log(`    Count: ${neverPunched.length} employees — NOT affected by deletion`);
  console.log('─'.repeat(70));

  // ── SUMMARY ─────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log('📊  SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅  Records STILL in DB today         : ${todayEvents.length}`);
  console.log(`🔴  Punch-in records DELETED           : ~${missingInFromYest.length} (employees who punched yesterday but not today)`);
  console.log(`🟡  Punch-out records DELETED/pending  : ${missingOut.length} employees missing punch-out today`);
  console.log(`⚪  Unaffected (inactive) employees    : ${neverPunched.length}`);
  console.log('');
  console.log('➡️   To restore: set DRY_RUN = false in restore_punchin_today.cjs');
  console.log('     Suggested punch-in time: check shift start (usually 09:00 IST)');
  console.log('='.repeat(70));
}

run().catch(console.error);
