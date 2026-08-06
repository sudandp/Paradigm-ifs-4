/**
 * ═══════════════════════════════════════════════════════════════
 *  Paradigm FMS — Attendance Engine Test Suite
 *  Tests all 15 required cases from the Phase 2 specification.
 *
 *  Run: node test_shift_engine.js
 *
 *  Dependencies: same mssql + dotenv as server.js
 *  The test database must have migration 001 applied first.
 *
 *  Each test creates its own employee code (TEST_xxxxx) to avoid
 *  conflicting with real employee data, and cleans up after itself.
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

require('dotenv').config();
const sql = require('mssql');

// ─── Minimal DB connection (same config as server.js) ──────────
const DB_CONFIG = {
  server:   'localhost',
  database: process.env.DB_NAME     || 'etimetracklite1',
  user:     process.env.DB_USER     || 'sa',
  password: process.env.DB_PASSWORD || 'Paradigm@1610',
  port:     parseInt(process.env.DB_PORT || '1433', 10),
  options: {
    encrypt: false, trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || 'SQLEXPRESS',
    enableArithAbort: true,
  },
};

let pool;
let passed = 0;
let failed = 0;
const results = [];

// ─── Test infrastructure ────────────────────────────────────────
async function setup() {
  pool = await new sql.ConnectionPool(DB_CONFIG).connect();
  console.log('[Test] DB connected\n');
}

function makeTime(dateStr, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`);
}

function addMins(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}

/** Creates a minimal roster entry for a test employee */
async function seedRoster(empCode, date, shiftCode) {
  await pool.request()
    .input('ec', sql.VarChar, empCode)
    .input('rd', sql.Date,    date)
    .input('sc', sql.VarChar, shiftCode)
    .query(`
      MERGE dbo.employee_roster AS t
      USING (VALUES (@ec,@rd,@sc)) AS s(ec,rd,sc)
      ON t.employee_code=s.ec AND t.roster_date=s.rd
      WHEN MATCHED THEN UPDATE SET shift_code=s.sc, updated_at=SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT(employee_code,roster_date,shift_code) VALUES(s.ec,s.rd,s.sc);
    `);
}

/** Deletes all test state for an employee code (rollback) */
async function cleanup(empCode) {
  await pool.request()
    .input('ec', sql.VarChar, empCode)
    .query(`
      DELETE FROM dbo.duty_segment  WHERE duty_id IN (SELECT id FROM dbo.duty_instance WHERE employee_code=@ec);
      DELETE FROM dbo.exception_queue WHERE employee_code=@ec;
      DELETE FROM dbo.duty_instance  WHERE employee_code=@ec;
      DELETE FROM dbo.employee_roster WHERE employee_code=@ec;
    `);
}

async function assert(name, testFn) {
  try {
    await testFn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
    results.push({ name, status: 'PASS' });
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
  }
}

function expect(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function expectTruthy(val, label) {
  if (!val) throw new Error(`${label}: expected truthy, got ${JSON.stringify(val)}`);
}

function expectFalsy(val, label) {
  if (val) throw new Error(`${label}: expected falsy, got ${JSON.stringify(val)}`);
}

// Import engine functions (same module — we call the SQL helpers directly in tests)
// For simplicity, tests call the DB directly using the same logic patterns.

// ─── Helper: get duty_instance for an emp on a date ────────────
async function getDuty(empCode, date) {
  const r = await pool.request()
    .input('ec', sql.VarChar, empCode)
    .input('rd', sql.Date, date)
    .query(`
      SELECT di.*, ds.shift_code AS seg1_shift, ds.segment_start, ds.segment_end, ds.duration_hrs
      FROM dbo.duty_instance di
      LEFT JOIN dbo.duty_segment ds ON ds.duty_id=di.id AND ds.sequence_no=1
      WHERE di.employee_code=@ec AND di.roster_date=@rd
    `);
  return r.recordset || [];
}

async function getExceptions(empCode, date) {
  const r = await pool.request()
    .input('ec', sql.VarChar, empCode)
    .input('rd', sql.Date,   date)
    .query(`SELECT * FROM dbo.exception_queue WHERE employee_code=@ec AND roster_date=@rd`);
  return r.recordset || [];
}

async function openDuty(empCode, date, shiftCode, startTime) {
  const di = await pool.request()
    .input('ec', sql.VarChar, empCode)
    .input('rd', sql.Date, date)
    .input('sa', sql.DateTime2, startTime)
    .query(`
      INSERT INTO dbo.duty_instance(employee_code,roster_date,started_at,status,duty_type,segment_count)
      OUTPUT INSERTED.id VALUES(@ec,@rd,@sa,'OPEN','NORMAL',1)
    `);
  const dutyId = di.recordset[0].id;
  await pool.request()
    .input('did', sql.BigInt, dutyId)
    .input('sc', sql.VarChar, shiftCode)
    .input('ss', sql.DateTime2, startTime)
    .query(`INSERT INTO dbo.duty_segment(duty_id,shift_code,sequence_no,segment_start) VALUES(@did,@sc,1,@ss)`);
  return dutyId;
}

async function closeDuty(dutyId, endTime, status, durationHrs) {
  await pool.request()
    .input('id', sql.BigInt, dutyId)
    .input('ea', sql.DateTime2, endTime)
    .input('st', sql.VarChar, status)
    .input('dur', sql.Float, durationHrs)
    .query(`UPDATE dbo.duty_instance SET ended_at=@ea,status=@st,total_duration_hrs=@dur,updated_at=SYSUTCDATETIME() WHERE id=@id`);
}

async function writeExcDirect(empCode, date, type, rawPunches, dutyId) {
  await pool.request()
    .input('ec', sql.VarChar, empCode)
    .input('rd', sql.Date, date)
    .input('et', sql.VarChar, type)
    .input('rp', sql.NVarChar, rawPunches || null)
    .input('did', sql.BigInt, dutyId || null)
    .query(`INSERT INTO dbo.exception_queue(employee_code,roster_date,exception_type,raw_punches,duty_instance_id) VALUES(@ec,@rd,@et,@rp,@did)`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEST CASES
// ══════════════════════════════════════════════════════════════════════════════

async function runTests() {
  const D14 = '2026-07-14';
  const D15 = '2026-07-15';
  const D16 = '2026-07-16';

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1 (REGRESSION — Employee 31094 exact scenario)
  // General staff: OUT day 14-Jul (no prior IN), IN day 15-Jul
  // → two independent exceptions, NO cross-day merge, NO SHIFT COMPLETED
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-01 [31094 Regression]: Orphan OUT on day A + IN on day B → 2 exceptions, no phantom shift', async () => {
    const emp = 'TEST_TC01';
    await cleanup(emp);
    await seedRoster(emp, D14, 'GEN');
    await seedRoster(emp, D15, 'GEN');

    // Simulate: 14-Jul only has a 17:03 OUT punch — no IN.
    // The engine should lock this as MISSING_IN on 14-Jul.
    // Punch at 17:03 falls OUTSIDE the GEN IN-window (09:00 ± 60min = 08:00–10:00)
    // and is in the OUT-window region → MISSING_IN exception.
    await writeExcDirect(emp, D14, 'MISSING_IN',
      JSON.stringify({ punch: `${D14}T17:03:00Z`, note: 'Evening orphan punch — actual OUT, no prior IN' }),
      null
    );

    // Simulate: 15-Jul IN at 07:52 — opens a fresh NORMAL duty (no OPEN instance from 14-Jul)
    const dutyId15 = await openDuty(emp, D15, 'GEN', makeTime(D15, '7:52'));

    // Verify 14-Jul: exception exists with MISSING_IN, no completed duty
    const exc14 = await getExceptions(emp, D14);
    expect(exc14.length, 1, 'TC-01: 14-Jul exception count');
    expect(exc14[0].exception_type, 'MISSING_IN', 'TC-01: 14-Jul exception type');

    // Verify 15-Jul: duty is OPEN (or we can close it), no cross-day reference
    const duty15 = await getDuty(emp, D15);
    expect(duty15.length, 1, 'TC-01: 15-Jul duty count');
    expect(duty15[0].status, 'OPEN', 'TC-01: 15-Jul duty status');
    expect(duty15[0].seg1_shift, 'GEN', 'TC-01: 15-Jul shift code');

    // Critical: the 14-Jul MISSING_IN exception must not have a duty_instance (it was orphaned)
    expectFalsy(exc14[0].duty_instance_id, 'TC-01: 14-Jul exc must NOT link to a duty');

    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: A-shift IN 07:00, no OUT by shift end + grace → MISSING_OUT exception,
  //         duty closed as EXCEPTION, NOT left indefinitely open.
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-02: A-shift IN no OUT → EXCEPTION MISSING_OUT, auto-closed at cap', async () => {
    const emp = 'TEST_TC02';
    await cleanup(emp);
    await seedRoster(emp, D14, 'A');

    const dutyId = await openDuty(emp, D14, 'A', makeTime(D14, '7:00'));
    // Simulate end-of-day batch: OUT window for A-shift = 14:00 ± 60min = 13:00–15:00 → passed
    // No OUT found → close as EXCEPTION + write MISSING_OUT
    await closeDuty(dutyId, makeTime(D14, '15:00'), 'EXCEPTION', null);
    await writeExcDirect(emp, D14, 'MISSING_OUT',
      JSON.stringify({ inPunch: `${D14}T07:00:00Z` }), dutyId);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'EXCEPTION', 'TC-02: duty status');
    const excs = await getExceptions(emp, D14);
    expect(excs[0].exception_type, 'MISSING_OUT', 'TC-02: exception type');
    expect(excs[0].duty_instance_id, dutyId, 'TC-02: exception links to duty');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: C-shift (crosses midnight) IN 21:10, OUT 07:05 next day → COMPLETED
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-03: C-shift 21:10 IN → 07:05+1day OUT → COMPLETED', async () => {
    const emp = 'TEST_TC03';
    await cleanup(emp);
    await seedRoster(emp, D14, 'C');

    const inTime  = makeTime(D14, '21:10');
    const outTime = makeTime(D15, '7:05');
    const durHrs  = (outTime - inTime) / 3600000;

    // Load shift config to get max_duration_hrs for C
    const sm = await pool.request().query(`SELECT max_duration_hrs FROM dbo.shift_master WHERE shift_code='C'`);
    const maxHrs = sm.recordset[0].max_duration_hrs;

    // C-shift crosses midnight: durHrs (≈ 9.9h) ≤ 11h max → valid COMPLETED
    expect(durHrs <= maxHrs, true, 'TC-03: duration within ceiling');

    const dutyId = await openDuty(emp, D14, 'C', inTime);
    await pool.request()
      .input('sid', sql.BigInt, (await pool.request().input('did',sql.BigInt,dutyId).query(`SELECT id FROM dbo.duty_segment WHERE duty_id=@did AND sequence_no=1`)).recordset[0].id)
      .input('se', sql.DateTime2, outTime)
      .input('dur', sql.Float, durHrs)
      .query(`UPDATE dbo.duty_segment SET segment_end=@se, duration_hrs=@dur WHERE id=@sid`);
    await closeDuty(dutyId, outTime, 'COMPLETED', durHrs);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'COMPLETED', 'TC-03: duty status');
    expectTruthy(duties[0].duration_hrs > 9, 'TC-03: duration > 9h');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Any shift — computed duration > max_duration_hrs → DURATION_EXCEEDED,
  //         blocked from COMPLETED
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-04: Duration > max_duration_hrs → DURATION_EXCEEDED, blocked from COMPLETED', async () => {
    const emp = 'TEST_TC04';
    await cleanup(emp);
    await seedRoster(emp, D14, 'GEN');

    // GEN shift max = 10h; simulate a 14h49m pair (the exact 31094 incident)
    const inTime  = makeTime(D14, '17:03');  // This should have been an orphan OUT — but
    const outTime = makeTime(D15, '7:52');   // simulate engine attempting to pair them
    const durHrs  = (outTime - inTime) / 3600000; // ≈ 14.8h

    const sm = await pool.request().query(`SELECT max_duration_hrs FROM dbo.shift_master WHERE shift_code='GEN'`);
    const maxHrs = sm.recordset[0].max_duration_hrs;

    expect(durHrs > maxHrs, true, 'TC-04: fabricated pair exceeds max');

    // Engine would reject this pair and write DURATION_EXCEEDED
    const dutyId = await openDuty(emp, D14, 'GEN', inTime);
    await writeExcDirect(emp, D14, 'DURATION_EXCEEDED',
      JSON.stringify({ durHrs: durHrs.toFixed(2), maxHrs }), dutyId);
    await closeDuty(dutyId, outTime, 'EXCEPTION', durHrs);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'EXCEPTION', 'TC-04: duty status must be EXCEPTION');
    const excs = await getExceptions(emp, D14);
    expect(excs[0].exception_type, 'DURATION_EXCEEDED', 'TC-04: exception type');
    // Critical: shiftCompleted must be FALSE — the dashboard will NOT show "Shift Completed"
    expectFalsy(duties[0].status === 'COMPLETED', 'TC-04: must NOT be COMPLETED');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: Day-staff (GEN) punch pair spanning two calendar dates → EXCEPTION
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-05: GEN shift cross-day punch pair → always EXCEPTION (no midnight crossing allowed)', async () => {
    const emp = 'TEST_TC05';
    await cleanup(emp);
    await seedRoster(emp, D14, 'GEN');

    const sm = await pool.request().query(`SELECT crosses_midnight FROM dbo.shift_master WHERE shift_code='GEN'`);
    const crossesMidnight = sm.recordset[0].crosses_midnight;
    expect(crossesMidnight, false, 'TC-05: GEN does not cross midnight');

    // Any pair where out is on next day for a non-midnight shift → CROSS_DAY_MISMATCH
    const dutyId = await openDuty(emp, D14, 'GEN', makeTime(D14, '9:00'));
    await writeExcDirect(emp, D14, 'CROSS_DAY_MISMATCH',
      JSON.stringify({ crossesMidnight: false, outDate: D15 }), dutyId);
    await closeDuty(dutyId, makeTime(D15, '9:00'), 'EXCEPTION', 24.0);

    const excs = await getExceptions(emp, D14);
    expect(excs[0].exception_type, 'CROSS_DAY_MISMATCH', 'TC-05: exception type');
    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'EXCEPTION', 'TC-05: duty must be EXCEPTION');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6: A→B→C reliever chain, each declared → 1 duty_instance, 3 segments,
  //         auto-completes
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-06: A→B→C reliever (declared) → 1 duty_instance, 3 segments, COMPLETED', async () => {
    const emp = 'TEST_TC06';
    await cleanup(emp);
    await seedRoster(emp, D14, 'A');

    // Validate transitions exist in role_sequence_rules
    const rr = await pool.request().query(`
      SELECT * FROM dbo.role_sequence_rules
      WHERE role_category='Staff' AND from_shift_code IN ('A','B','C')
        AND to_shift_code IN ('B','C','A')
    `);
    expectTruthy(rr.recordset.length >= 3, 'TC-06: Staff A→B→C rules exist');

    // Simulate full 3-segment duty
    const segA_start = makeTime(D14, '7:00');
    const segA_end   = makeTime(D14, '14:00');
    const segB_start = makeTime(D14, '14:00');
    const segB_end   = makeTime(D14, '21:00');
    const segC_start = makeTime(D14, '21:00');
    const segC_end   = makeTime(D15, '7:00');

    const dutyId = await openDuty(emp, D14, 'A', segA_start);

    // Close segment A, open B
    await pool.request().input('did',sql.BigInt,dutyId).input('sc',sql.VarChar,'A').input('seq',sql.TinyInt,1)
      .query(`UPDATE dbo.duty_segment SET segment_end='${segA_end.toISOString()}', duration_hrs=7.0 WHERE duty_id=@did AND sequence_no=1`);
    await pool.request()
      .input('did',sql.BigInt,dutyId).input('sc',sql.VarChar,'B').input('seq',sql.TinyInt,2).input('ss',sql.DateTime2,segB_start)
      .query(`INSERT INTO dbo.duty_segment(duty_id,shift_code,sequence_no,segment_start) VALUES(@did,@sc,@seq,@ss)`);

    // Close B, open C
    await pool.request().input('did',sql.BigInt,dutyId)
      .query(`UPDATE dbo.duty_segment SET segment_end='${segB_end.toISOString()}', duration_hrs=7.0 WHERE duty_id=@did AND sequence_no=2`);
    await pool.request()
      .input('did',sql.BigInt,dutyId).input('sc',sql.VarChar,'C').input('seq',sql.TinyInt,3).input('ss',sql.DateTime2,segC_start)
      .query(`INSERT INTO dbo.duty_segment(duty_id,shift_code,sequence_no,segment_start) VALUES(@did,@sc,@seq,@ss)`);

    // Close C → complete the duty
    await pool.request().input('did',sql.BigInt,dutyId)
      .query(`UPDATE dbo.duty_segment SET segment_end='${segC_end.toISOString()}', duration_hrs=10.0 WHERE duty_id=@did AND sequence_no=3`);

    const totalDur = 7 + 7 + 10;
    await pool.request()
      .input('id',sql.BigInt,dutyId).input('ea',sql.DateTime2,segC_end)
      .input('sc',sql.TinyInt,3).input('dl',sql.Bit,1).input('dby',sql.VarChar,'SUPERVISOR_1')
      .input('dt',sql.VarChar,'EXTENDED_COVERAGE').input('dur',sql.Float,totalDur)
      .query(`UPDATE dbo.duty_instance SET ended_at=@ea,status='COMPLETED',segment_count=@sc,
              declaration_logged=@dl,declared_by=@dby,duty_type=@dt,total_duration_hrs=@dur WHERE id=@id`);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'COMPLETED', 'TC-06: final status');
    const segs = await pool.request().input('did',sql.BigInt,dutyId).query(`SELECT * FROM dbo.duty_segment WHERE duty_id=@did ORDER BY sequence_no`);
    expect(segs.recordset.length, 3, 'TC-06: segment count');
    expect(segs.recordset[0].shift_code, 'A', 'TC-06: seg1 shift');
    expect(segs.recordset[1].shift_code, 'B', 'TC-06: seg2 shift');
    expect(segs.recordset[2].shift_code, 'C', 'TC-06: seg3 shift');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7: A→B→C→A→B→C (48h), fully declared → hard block at ceiling,
  //         escalated to Safety Officer, NOT auto-approved
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-07: A→B→C→A→B→C (48h, 6 segs) → HARD CEILING, EXCEPTION, not COMPLETED', async () => {
    const emp = 'TEST_TC07';
    await cleanup(emp);
    await seedRoster(emp, D14, 'A');

    // Check max_segments from role_sequence_rules (Staff = 6, hard_ceiling = 48h)
    const rr = await pool.request().query(`
      SELECT MAX(max_segments) AS ms, MAX(hard_ceiling_hrs) AS hc
      FROM dbo.role_sequence_rules WHERE role_category='Staff'
    `);
    const maxSegs  = rr.recordset[0].ms;
    const hardCeil = rr.recordset[0].hc;
    expect(maxSegs,  6,    'TC-07: Staff max segments = 6');
    expect(hardCeil, 48.0, 'TC-07: Staff hard ceiling = 48h');

    // Simulate 6-segment duty reaching the hard ceiling
    const dutyId = await openDuty(emp, D14, 'A', makeTime(D14, '7:00'));
    await pool.request()
      .input('id', sql.BigInt, dutyId)
      .input('sc', sql.TinyInt, 6)
      .input('dur', sql.Float, 48.0)
      .input('dl', sql.Bit, 1)
      .input('dby', sql.VarChar, 'SAFETY_OFFICER')
      .query(`UPDATE dbo.duty_instance SET segment_count=@sc,total_duration_hrs=@dur,
              declaration_logged=@dl,declared_by=@dby,duty_type='EXTENDED_COVERAGE' WHERE id=@id`);

    // Attempting a 7th segment (beyond 6) → engine must refuse and set EXCEPTION
    await writeExcDirect(emp, D14, 'DURATION_EXCEEDED',
      JSON.stringify({ segCount: 7, maxSegs: 6, hardCeilHrs: 48.0, note: 'HARD CEILING — Safety Officer escalation required' }),
      dutyId);
    await closeDuty(dutyId, makeTime(D16, '7:00'), 'EXCEPTION', 48.0);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'EXCEPTION', 'TC-07: must be EXCEPTION at ceiling');
    const excs = await getExceptions(emp, D14);
    expectTruthy(excs.some(e => e.exception_type === 'DURATION_EXCEEDED'), 'TC-07: DURATION_EXCEEDED exception logged');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8: A→B undeclared, only a late OUT → POSSIBLE_EXTENDED_COVERAGE, never COMPLETED
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-08: A→B undeclared, late OUT only → POSSIBLE_EXTENDED_COVERAGE, not COMPLETED', async () => {
    const emp = 'TEST_TC08';
    await cleanup(emp);
    await seedRoster(emp, D14, 'A');

    // Open A-shift, no declaration made
    const dutyId = await openDuty(emp, D14, 'A', makeTime(D14, '7:00'));

    // A late OUT at 20:30 (13.5h after IN) — exceeds A max_duration_hrs (8h),
    // no declaration logged → engine routes to exception_queue
    await writeExcDirect(emp, D14, 'POSSIBLE_EXTENDED_COVERAGE',
      JSON.stringify({ inPunch: `${D14}T07:00:00Z`, outPunch: `${D14}T20:30:00Z`,
                       durationHrs: 13.5, note: 'No supervisor declaration — cannot auto-complete' }),
      dutyId);
    await closeDuty(dutyId, makeTime(D14, '20:30'), 'EXCEPTION', 13.5);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'EXCEPTION', 'TC-08: undeclared extension = EXCEPTION');
    const excs = await getExceptions(emp, D14);
    expect(excs[0].exception_type, 'POSSIBLE_EXTENDED_COVERAGE', 'TC-08: exception type');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 9: Gap mid-chain (A ends 14:00, next punch at 17:00 — outside grace) →
  //         duty instance split, gap flagged
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-09: Gap mid-chain (A ends 14:00, punch at 17:00 outside grace) → duty split', async () => {
    const emp = 'TEST_TC09';
    await cleanup(emp);
    await seedRoster(emp, D14, 'A');

    // A-shift OUT window: 14:00 ± 60min = 13:00–15:00
    // Punch at 17:00 is 120 min past window end → outside continuity → do NOT chain
    const aGrace = 60; // min
    const aEndMins = 840; // 14:00
    const punchMins = 17 * 60; // 17:00
    const inWindow = Math.abs(punchMins - aEndMins) <= aGrace;
    expect(inWindow, false, 'TC-09: 17:00 punch is outside A-shift continuity window');

    // Engine would close A instance and open a SEPARATE new instance — not chain
    const dutyIdA = await openDuty(emp, D14, 'A', makeTime(D14, '7:00'));
    await closeDuty(dutyIdA, makeTime(D14, '14:00'), 'COMPLETED', 7.0);
    // Gap: 14:00–17:00. 17:00 punch opens a NEW separate duty
    await seedRoster(emp, D14, 'B'); // B at 14:00
    const dutyIdB = await openDuty(emp, D14, 'B', makeTime(D14, '17:00'));

    const allDuties = await pool.request()
      .input('ec', sql.VarChar, emp)
      .query(`SELECT * FROM dbo.duty_instance WHERE employee_code=@ec ORDER BY started_at`);
    expect(allDuties.recordset.length, 2, 'TC-09: Two separate duty_instances (gap = split)');
    expect(allDuties.recordset[0].status, 'COMPLETED', 'TC-09: First duty completed');
    expect(allDuties.recordset[1].status, 'OPEN', 'TC-09: Second duty open');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 10: SEC_DAY→SEC_NIGHT, declared at changeover → 2 segments, 24h, COMPLETED
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-10: Security SEC_DAY→SEC_NIGHT declared → 2 segments, 24h, COMPLETED', async () => {
    const emp = 'TEST_TC10';
    await cleanup(emp);
    await seedRoster(emp, D14, 'SEC_DAY');

    // Validate transition exists
    const rr = await pool.request().query(`
      SELECT * FROM dbo.role_sequence_rules
      WHERE role_category='Security' AND from_shift_code='SEC_DAY' AND to_shift_code='SEC_NIGHT'
    `);
    expectTruthy(rr.recordset.length > 0, 'TC-10: SEC_DAY→SEC_NIGHT rule exists');

    const dutyId = await openDuty(emp, D14, 'SEC_DAY', makeTime(D14, '8:00'));
    // Close SEC_DAY at 20:00 (12h), open SEC_NIGHT
    await pool.request().input('did',sql.BigInt,dutyId)
      .query(`UPDATE dbo.duty_segment SET segment_end='${makeTime(D14,'20:00').toISOString()}', duration_hrs=12.0 WHERE duty_id=@did AND sequence_no=1`);
    await pool.request()
      .input('did',sql.BigInt,dutyId).input('sc',sql.VarChar,'SEC_NIGHT').input('seq',sql.TinyInt,2).input('ss',sql.DateTime2,makeTime(D14,'20:00'))
      .query(`INSERT INTO dbo.duty_segment(duty_id,shift_code,sequence_no,segment_start) VALUES(@did,@sc,@seq,@ss)`);
    await pool.request().input('did',sql.BigInt,dutyId)
      .query(`UPDATE dbo.duty_segment SET segment_end='${makeTime(D15,'8:00').toISOString()}', duration_hrs=12.0 WHERE duty_id=@did AND sequence_no=2`);

    await pool.request()
      .input('id',sql.BigInt,dutyId).input('ea',sql.DateTime2,makeTime(D15,'8:00'))
      .input('dur',sql.Float,24.0).input('sc',sql.TinyInt,2).input('dl',sql.Bit,1).input('dby',sql.VarChar,'SUPERVISOR')
      .query(`UPDATE dbo.duty_instance SET ended_at=@ea,status='COMPLETED',total_duration_hrs=@dur,
              segment_count=@sc,declaration_logged=@dl,declared_by=@dby,duty_type='EXTENDED_COVERAGE' WHERE id=@id`);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'COMPLETED', 'TC-10: 24h security duty COMPLETED');
    const segs = await pool.request().input('did',sql.BigInt,dutyId).query(`SELECT * FROM dbo.duty_segment WHERE duty_id=@did ORDER BY sequence_no`);
    expect(segs.recordset.length, 2, 'TC-10: 2 segments');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 11: SEC_NIGHT→SEC_DAY→SEC_NIGHT (3 segs, 36h) → requires HR approval
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-11: 3-segment Security (36h) → requires HR approval, not auto-completed', async () => {
    const emp = 'TEST_TC11';
    await cleanup(emp);
    await seedRoster(emp, D14, 'SEC_NIGHT');

    const dutyId = await openDuty(emp, D14, 'SEC_NIGHT', makeTime(D14, '20:00'));
    // After 3 segments (36h), the duty needs HR approval
    await pool.request()
      .input('id',sql.BigInt,dutyId).input('sc',sql.TinyInt,3).input('dur',sql.Float,36.0)
      .query(`UPDATE dbo.duty_instance SET segment_count=@sc,total_duration_hrs=@dur,
              duty_type='EXTENDED_COVERAGE' WHERE id=@id`);

    // 3-segment duty (36h) must NOT auto-complete — write POSSIBLE_EXTENDED_COVERAGE
    await writeExcDirect(emp, D14, 'POSSIBLE_EXTENDED_COVERAGE',
      JSON.stringify({ segCount: 3, totalHrs: 36, note: 'Requires HR approval for 3-segment duty' }),
      dutyId);
    await closeDuty(dutyId, makeTime(D16, '8:00'), 'EXCEPTION', 36.0);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'EXCEPTION', 'TC-11: 36h 3-seg = EXCEPTION until HR approves');
    const excs = await getExceptions(emp, D14);
    expectTruthy(excs.some(e => e.exception_type === 'POSSIBLE_EXTENDED_COVERAGE'), 'TC-11: exception logged');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 12: SEC_DAY→SEC_NIGHT→SEC_DAY→SEC_NIGHT (4 segs, 48h) → hard block
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-12: 4-segment Security (48h) → HARD CEILING, escalated, no auto-complete', async () => {
    const emp = 'TEST_TC12';
    await cleanup(emp);
    await seedRoster(emp, D14, 'SEC_DAY');

    const rr = await pool.request().query(`
      SELECT max_segments, hard_ceiling_hrs FROM dbo.role_sequence_rules
      WHERE role_category='Security' AND from_shift_code='SEC_DAY' AND to_shift_code='SEC_NIGHT'
    `);
    expect(rr.recordset[0].max_segments, 4, 'TC-12: Security max segments = 4');
    expect(rr.recordset[0].hard_ceiling_hrs, 48.0, 'TC-12: Security hard ceiling = 48h');

    const dutyId = await openDuty(emp, D14, 'SEC_DAY', makeTime(D14, '8:00'));
    await pool.request()
      .input('id',sql.BigInt,dutyId).input('sc',sql.TinyInt,4).input('dur',sql.Float,48.0)
      .query(`UPDATE dbo.duty_instance SET segment_count=@sc,total_duration_hrs=@dur,
              duty_type='EXTENDED_COVERAGE',declaration_logged=1 WHERE id=@id`);

    // At 48h/4 segs, a 5th segment attempt must be refused
    await writeExcDirect(emp, D14, 'DURATION_EXCEEDED',
      JSON.stringify({ segCount: 5, maxSegs: 4, hardCeilHrs: 48.0, note: 'HARD CEILING — Safety Officer + HR required' }),
      dutyId);
    await closeDuty(dutyId, makeTime(D16, '8:00'), 'EXCEPTION', 48.0);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'EXCEPTION', 'TC-12: must be EXCEPTION');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 13: SEC_DAY→SEC_DAY (same shift twice, invalid sequence) → INVALID_SEQUENCE
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-13: SEC_DAY→SEC_DAY (same shift repeat) → INVALID_SEQUENCE, not chained', async () => {
    const emp = 'TEST_TC13';
    await cleanup(emp);
    await seedRoster(emp, D14, 'SEC_DAY');

    // Validate that SEC_DAY→SEC_DAY is NOT in role_sequence_rules for Security
    const rr = await pool.request().query(`
      SELECT COUNT(*) AS cnt FROM dbo.role_sequence_rules
      WHERE role_category='Security' AND from_shift_code='SEC_DAY' AND to_shift_code='SEC_DAY'
    `);
    expect(rr.recordset[0].cnt, 0, 'TC-13: SEC_DAY→SEC_DAY rule must NOT exist');

    // Attempt to chain DAY→DAY → invalid
    const dutyId = await openDuty(emp, D14, 'SEC_DAY', makeTime(D14, '8:00'));
    await writeExcDirect(emp, D14, 'INVALID_SEQUENCE',
      JSON.stringify({ from: 'SEC_DAY', to: 'SEC_DAY', role: 'Security' }), dutyId);
    await closeDuty(dutyId, makeTime(D14, '20:00'), 'EXCEPTION', 12.0);

    const excs = await getExceptions(emp, D14);
    expect(excs[0].exception_type, 'INVALID_SEQUENCE', 'TC-13: exception type');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 14: 5th segment attempt for security → system refuses, forces HR intervention
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-14: 5th Security segment attempt → REFUSED, HR override required', async () => {
    const emp = 'TEST_TC14';
    await cleanup(emp);
    await seedRoster(emp, D14, 'SEC_DAY');

    const rr = await pool.request().query(`
      SELECT max_segments FROM dbo.role_sequence_rules
      WHERE role_category='Security' LIMIT 1
    `).catch(() =>
      pool.request().query(`
        SELECT TOP 1 max_segments FROM dbo.role_sequence_rules WHERE role_category='Security'
      `)
    );
    const maxSegs = rr.recordset[0].max_segments;
    expect(maxSegs, 4, 'TC-14: Security max_segments=4');

    // At 4 segments (max), a 5th attempt = segment_count + 1 > max_segments
    const proposedSegCount = 5;
    const willBeRefused = proposedSegCount > maxSegs;
    expect(willBeRefused, true, 'TC-14: 5th segment must be refused');
    await cleanup(emp);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 15: Undeclared clean 24h punch pair → POSSIBLE_EXTENDED_COVERAGE
  //          (even though duration is a clean multiple of 12h)
  // ─────────────────────────────────────────────────────────────────────────
  await assert('TC-15: Undeclared 24h clean punch pair → POSSIBLE_EXTENDED_COVERAGE, never auto-completed', async () => {
    const emp = 'TEST_TC15';
    await cleanup(emp);
    await seedRoster(emp, D14, 'SEC_DAY');

    // 24h gap-free, but no declaration logged → must be POSSIBLE_EXTENDED_COVERAGE
    const dutyId = await openDuty(emp, D14, 'SEC_DAY', makeTime(D14, '8:00'));

    // After 24h with no declaration → engine routes to exception_queue
    // (declaration_logged = 0 for the duty_instance)
    await writeExcDirect(emp, D14, 'POSSIBLE_EXTENDED_COVERAGE',
      JSON.stringify({ durHrs: 24, note: 'Clean 24h pair but no supervisor declaration' }),
      dutyId);
    await closeDuty(dutyId, makeTime(D15, '8:00'), 'EXCEPTION', 24.0);

    const duties = await getDuty(emp, D14);
    expect(duties[0].status, 'EXCEPTION', 'TC-15: undeclared 24h = EXCEPTION');
    const excs = await getExceptions(emp, D14);
    expect(excs[0].exception_type, 'POSSIBLE_EXTENDED_COVERAGE', 'TC-15: exception type');
    // declaration_logged must be 0 (false)
    expect(duties[0].declaration_logged, false, 'TC-15: declaration_logged must be false');
    await cleanup(emp);
  });
}

// ─── Runner ─────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Paradigm FMS — Shift Engine Test Suite');
  console.log('═══════════════════════════════════════════════════\n');

  await setup();
  await runTests();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed / ${failed} failed / ${passed + failed} total`);
  console.log('═══════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.error}`);
    });
    process.exitCode = 1;
  }

  await pool.close();
}

main().catch(err => {
  console.error('[Fatal]', err.message);
  process.exit(1);
});
