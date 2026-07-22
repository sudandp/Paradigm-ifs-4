/**
 * ============================================================
 * RESTORE PUNCH-IN RECORDS — TODAY 2026-07-22
 * ============================================================
 * DIAGNOSIS RESULT:
 *   - Yesterday had 123 punch-in + 57 punch-out events
 *   - Today (after deletion) has ONLY 32 punch-in events
 *   - That means ~91 punch-in + ALL punch-out were deleted
 *   - The 32 remaining punch-ins are from AFTER the deletion
 *
 * STRATEGY:
 *   - Only restore for employees with NO punch-in today
 *   - Employees who re-punched after deletion → already have one
 *   - Original timestamps are gone; we insert approximate times
 *
 * STEP 1: Run in AUDIT mode first (DRY_RUN = true)
 *         → Shows which employees are MISSING punch-in today
 * STEP 2: Set DRY_RUN = false to actually restore
 *         → Re-inserts punch-in events with a default time
 * ============================================================
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ============================================================
// CONFIG — EDIT THESE BEFORE RUNNING
// ============================================================

// Set to false ONLY after you confirm the audit results are correct
const DRY_RUN = true;

// ⚠️  SET THIS to the actual time employees usually punch in (IST 24h)
// Check payroll/shift records for correct time
// e.g., '09:00' for 9:00 AM, '08:30' for 8:30 AM
const DEFAULT_PUNCHIN_TIME_IST = '09:00';

// Today's date in IST (2026-07-22)
const TODAY_DATE_IST = '2026-07-22';

// Roles to EXCLUDE from restore (these roles may not use the punch system)
// Add more roles here if needed
const EXCLUDE_ROLES = ['unverified', 'admin', 'super_admin', 'kiosk', 'management', 'finance_manager'];

// Roles to restore for (exclude admin/kiosk/unverified roles)
// Set to null to include ALL roles
const INCLUDE_ROLES = null; // or e.g. ['security_guard', 'field_officer']

// ============================================================
// HELPERS
// ============================================================

function buildTimestamp(dateStr, timeStr) {
  // Builds a UTC ISO string from IST date + time
  // e.g., '2026-07-22' + '09:00' → '2026-07-22T03:30:00.000Z'
  const [hours, minutes] = timeStr.split(':').map(Number);
  const istDate = new Date(`${dateStr}T${timeStr}:00+05:30`);
  return istDate.toISOString();
}

// IST midnight to midnight UTC range for today
function getTodayUTCRange(dateStr) {
  const startIST = new Date(`${dateStr}T00:00:00+05:30`);
  const endIST   = new Date(`${dateStr}T23:59:59+05:30`);
  return {
    start: startIST.toISOString(),
    end:   endIST.toISOString(),
  };
}

// ============================================================
// MAIN
// ============================================================

async function run() {
  console.log('='.repeat(60));
  console.log('PUNCH-IN RECOVERY SCRIPT');
  console.log(`Mode: ${DRY_RUN ? '🔍 AUDIT (dry-run, no writes)' : '⚡ LIVE RESTORE'}`);
  console.log(`Date: ${TODAY_DATE_IST} IST`);
  console.log(`Default restore time: ${DEFAULT_PUNCHIN_TIME_IST} IST`);
  console.log('='.repeat(60));

  const { start, end } = getTodayUTCRange(TODAY_DATE_IST);
  console.log(`UTC range: ${start} → ${end}\n`);

  // ── 1. Fetch all active employees ───────────────────────────
  let userQuery = supabase
    .from('users')
    .select('id, name, role_id, organization_name')
    .not('role_id', 'in', '("unverified","admin","super_admin","kiosk")');

  if (INCLUDE_ROLES) {
    userQuery = userQuery.in('role_id', INCLUDE_ROLES);
  }

  const { data: users, error: usersErr } = await userQuery;
  if (usersErr) {
    console.error('❌ Failed to fetch users:', usersErr.message);
    return;
  }
  console.log(`✅ Total active employees found: ${users.length}\n`);

  // ── 2. Fetch today's existing punch-in events ───────────────
  const { data: existingEvents, error: eventsErr } = await supabase
    .from('attendance_events')
    .select('user_id, type, timestamp')
    .in('type', ['punch-in', 'check-in'])
    .gte('timestamp', start)
    .lte('timestamp', end);

  if (eventsErr) {
    console.error('❌ Failed to fetch existing events:', eventsErr.message);
    return;
  }

  const alreadyPunchedInIds = new Set((existingEvents || []).map(e => e.user_id));
  console.log(`✅ Employees who ALREADY have punch-in today: ${alreadyPunchedInIds.size}`);
  if (alreadyPunchedInIds.size > 0) {
    const alreadyPunchedUsers = users.filter(u => alreadyPunchedInIds.has(u.id));
    console.log('   (These will be SKIPPED — not duplicated)');
    alreadyPunchedUsers.forEach(u => console.log(`   - ${u.name} [${u.role_id}]`));
  }

  // ── 3. Find employees MISSING punch-in ──────────────────────
  const missingUsers = users.filter(u => !alreadyPunchedInIds.has(u.id));
  console.log(`\n⚠️  Employees MISSING punch-in today: ${missingUsers.length}`);
  missingUsers.forEach(u =>
    console.log(`   - ${u.name} [${u.role_id}] | org: ${u.organization_name || 'N/A'} | id: ${u.id}`)
  );

  if (missingUsers.length === 0) {
    console.log('\n✅ No missing punch-ins found. Nothing to restore.');
    return;
  }

  // ── 4. DRY RUN exit ─────────────────────────────────────────
  if (DRY_RUN) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 DRY RUN — No data was written.');
    console.log('   Review the list above.');
    console.log(`   Set DRY_RUN = false and DEFAULT_PUNCHIN_TIME_IST = 'HH:MM'`);
    console.log('   to restore the missing records.');
    console.log('='.repeat(60));
    return;
  }

  // ── 5. LIVE RESTORE ─────────────────────────────────────────
  console.log(`\n⚡ Restoring punch-in at ${DEFAULT_PUNCHIN_TIME_IST} IST for ${missingUsers.length} employees...`);

  const restoredTimestamp = buildTimestamp(TODAY_DATE_IST, DEFAULT_PUNCHIN_TIME_IST);
  const insertRows = missingUsers.map(u => ({
    user_id: u.id,
    type: 'punch-in',
    timestamp: restoredTimestamp,
    latitude: null,
    longitude: null,
    location_id: null,
    // No extra column — but leave a note in console
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('attendance_events')
    .insert(insertRows)
    .select('id, user_id, timestamp');

  if (insertErr) {
    console.error('❌ Insert failed:', insertErr.message);
    console.error(insertErr);
    return;
  }

  console.log(`\n✅ Successfully restored ${inserted.length} punch-in records!`);
  console.log('\nRestored records:');
  missingUsers.forEach((u, i) => {
    const rec = inserted[i];
    console.log(`   ✅ ${u.name} [${u.role_id}] → event id: ${rec?.id} @ ${DEFAULT_PUNCHIN_TIME_IST} IST`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ RESTORE COMPLETE');
  console.log(`   ${inserted.length} punch-in records inserted for ${TODAY_DATE_IST}`);
  console.log('   NOTE: Timestamps are approximate (system-restored).');
  console.log('   You may manually adjust individual times via Supabase Dashboard.');
  console.log('='.repeat(60));
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
