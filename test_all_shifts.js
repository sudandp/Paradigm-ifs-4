// Comprehensive Multi-Shift Verification Test Suite
// Tests A, B, C, A+B, B+C, A+C shifts

function parseMinutes(tStr) {
  if (!tStr || tStr === '—') return null;
  const m = tStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function evaluateEmployeeShiftAndLate(emp) {
  const isMep = true; // Testing MEP technician shifts
  const period = emp.inTime ? (emp.inTime.toLowerCase().includes('pm') ? 'PM' : 'AM') : 'AM';
  let outPeriod = 'AM';
  const totalInMinutes = parseMinutes(emp.inTime);
  let totalOutMinutes = null;
  if (emp.outTime && emp.outTime !== '—') {
    const timeMatch = emp.outTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      outPeriod = timeMatch[3].toUpperCase();
      if (outPeriod === 'PM' && hours < 12) hours += 12;
      if (outPeriod === 'AM' && hours === 12) hours = 0;
      totalOutMinutes = hours * 60 + minutes;
    }
  }

  let elapsedMinutes = (totalInMinutes !== null && totalOutMinutes !== null) ? (totalOutMinutes - totalInMinutes) : 0;
  const isNextDayOut = Boolean(
    emp.isNextDayOut || 
    (totalInMinutes !== null && totalOutMinutes !== null && (
      (totalInMinutes >= 18 * 60 && totalOutMinutes <= 13 * 60) || 
      (outPeriod === 'AM' && period === 'PM') ||
      (totalInMinutes < 12 * 60 && totalOutMinutes <= 12 * 60 && ((emp.shiftName || '').includes('+') || (emp.shiftCode || '').includes('+')))
    ))
  );
  if ((isNextDayOut || elapsedMinutes < 0) && totalInMinutes !== null && totalOutMinutes !== null) {
    elapsedMinutes += 24 * 60;
  }

  let shiftName = 'A Shift Group';
  let shiftCode = 'A';
  let shiftTiming = '07:00 AM - 02:00 PM';
  let targetStartMins = 7 * 60;
  let shiftType = emp.shiftType || 'single';

  // Double Shift Detection 1: A + C Shift (Morning + Night Duty crossing into next day morning)
  if (
    isNextDayOut && (
      (emp.shiftName && (emp.shiftName.includes('A + C') || emp.shiftName.includes('A+C'))) ||
      (emp.shiftType === 'double' && totalInMinutes < 11 * 60) ||
      (totalInMinutes < 11 * 60 && totalOutMinutes !== null && totalOutMinutes <= 13 * 60)
    )
  ) {
    shiftName = 'A + C Shift Group';
    shiftCode = 'A+C';
    shiftTiming = '07:00 AM - 02:00 PM | 09:00 PM - 07:00 AM';
    shiftType = 'double';
    targetStartMins = 7 * 60;
  }
  // Double Shift Detection 2: A + B Shift (Continuous or split morning to evening, on SAME DAY)
  else if (
    (emp.shiftName && (emp.shiftName.includes('A + B') || emp.shiftName.includes('A+B'))) ||
    (!isNextDayOut && (emp.shiftName || '').includes('+')) ||
    (!isNextDayOut && totalInMinutes < 11 * 60 && totalOutMinutes !== null && totalOutMinutes >= 19 * 60 + 30 && elapsedMinutes >= 11 * 60 + 30)
  ) {
    shiftName = 'A + B Shift Group';
    shiftCode = 'A+B';
    shiftTiming = '07:00 AM - 02:00 PM | 02:00 PM - 09:00 PM';
    shiftType = 'double';
    targetStartMins = 7 * 60;
  }
  // Double Shift Detection 3: B + C Shift (Afternoon + Night Duty)
  else if (
    (emp.shiftName && (emp.shiftName.includes('B + C') || emp.shiftName.includes('B+C'))) ||
    (totalInMinutes >= 11 * 60 + 30 && totalInMinutes <= 17 * 60 && isNextDayOut)
  ) {
    shiftName = 'B + C Shift Group';
    shiftCode = 'B+C';
    shiftTiming = '02:00 PM - 09:00 PM | 09:00 PM - 07:00 AM';
    shiftType = 'double';
    targetStartMins = 14 * 60;
  }
  // Single Shifts:
  // B Shift (02:00 PM – 09:00 PM): Punches from 11:30 AM up to 18:30 PM (without next day out)
  else if (!isNextDayOut && totalInMinutes >= 11 * 60 + 30 && totalInMinutes < 18 * 60 + 30) {
    shiftName = 'B Shift Group';
    shiftCode = 'B';
    shiftTiming = '02:00 PM - 09:00 PM';
    targetStartMins = 14 * 60;
  }
  // C Shift (09:00 PM – 07:00 AM): Punches from 18:30 PM onwards or early morning before 05:00 AM
  else if (totalInMinutes >= 18 * 60 + 30 || totalInMinutes < 5 * 60) {
    shiftName = 'C Shift Group';
    shiftCode = 'C';
    shiftTiming = '09:00 PM - 07:00 AM';
    targetStartMins = 21 * 60;
  }
  // General Shift (09:00 AM – 06:00 PM): Office/Technical Manager/Executive starting 08:45 AM – 10:30 AM
  else if (totalInMinutes >= 8 * 60 + 45 && totalInMinutes <= 10 * 60 + 30 && (emp.designation || '').toLowerCase().includes('manager')) {
    shiftName = 'General Shift Group';
    shiftCode = 'GEN';
    shiftTiming = '09:00 AM - 06:00 PM';
    targetStartMins = 9 * 60;
  }
  // A Shift (07:00 AM – 02:00 PM): Morning punches (05:00 AM to 11:30 AM)
  else {
    shiftName = 'A Shift Group';
    shiftCode = 'A';
    shiftTiming = '07:00 AM - 02:00 PM';
    targetStartMins = 7 * 60;
  }

  const calcLate = (totalInMinutes > targetStartMins && totalInMinutes < targetStartMins + 360) 
    ? (totalInMinutes - targetStartMins) 
    : 0;

  const isDoubleDuty = shiftType === 'double';
  const totalDuties = isDoubleDuty ? 2 : 1;

  // Live Working Hours calculation
  let diff = -1;
  if (emp.workingHours && emp.workingHours !== '-' && emp.workingHours !== '0h 00m' && !emp.workingHours.includes('0h 00m')) {
    // Already pre-computed
  } else if (totalInMinutes !== null && totalOutMinutes !== null) {
    let gross = totalOutMinutes - totalInMinutes;
    if (isNextDayOut && gross <= 0) gross += 24 * 60;
    else if (isNextDayOut && (totalInMinutes < 12 * 60 && totalOutMinutes <= 13 * 60)) gross += 24 * 60;
    const breakDeduct = isDoubleDuty ? 60 : 30;
    diff = Math.max(0, gross - breakDeduct);
  }

  const workingHoursStr = emp.workingHours || (diff >= 0 ? `${Math.floor(diff / 60)}h ${String(diff % 60).padStart(2, '0')}m` : '-');

  // OT calculation
  let otHoursVal = '0h 00m';
  if (workingHoursStr !== '-') {
    const parseMinsFromHrs = (h) => {
      const m = h.match(/(\d+)h\s*(\d+)m/);
      if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      const h2 = h.match(/(\d+)h/);
      if (h2) return parseInt(h2[1], 10) * 60;
      return 0;
    };
    const totalNetMins = parseMinsFromHrs(workingHoursStr);
    if (isDoubleDuty) {
      const baseShiftMins = 7 * 60;
      const otMins = Math.max(0, totalNetMins - baseShiftMins);
      otHoursVal = `${Math.floor(otMins / 60)}h ${String(otMins % 60).padStart(2, '0')}m (1 Duty OT)`;
    } else {
      const shiftExpHrs = (shiftCode || shiftName || '').includes('12') ? 12 : 7;
      const otMins = Math.max(0, totalNetMins - shiftExpHrs * 60);
      if (otMins > 0) {
        otHoursVal = `${Math.floor(otMins / 60)}h ${String(otMins % 60).padStart(2, '0')}m`;
      }
    }
  }

  return {
    shiftName,
    shiftCode,
    shiftTiming,
    shiftType,
    totalDuties,
    workingHours: workingHoursStr,
    otHours: otHoursVal,
    lateMinutes: calcLate,
    isNextDayOut
  };
}

// ── Test Cases Matrix ──
const testCases = [
  {
    name: '1. Single A Shift (Morning)',
    emp: { inTime: '07:05 am', outTime: '02:08 pm', designation: 'Electrician' },
    expected: { shiftName: 'A Shift Group', shiftCode: 'A', shiftType: 'single', totalDuties: 1, isNextDayOut: false }
  },
  {
    name: '2. Single B Shift (Afternoon/Evening)',
    emp: { inTime: '02:11 pm', outTime: '08:44 pm', designation: 'Plumber' },
    expected: { shiftName: 'B Shift Group', shiftCode: 'B', shiftType: 'single', totalDuties: 1, isNextDayOut: false }
  },
  {
    name: '3. Single C Shift (Night to next morning)',
    emp: { inTime: '09:05 pm', outTime: '07:02 am', designation: 'Electrician' },
    expected: { shiftName: 'C Shift Group', shiftCode: 'C', shiftType: 'single', totalDuties: 1, isNextDayOut: true }
  },
  {
    name: '4. Double A + B Shift (Continuous Same Day)',
    emp: { inTime: '07:06 am', outTime: '08:45 pm', designation: 'Electrician' },
    expected: { shiftName: 'A + B Shift Group', shiftCode: 'A+B', shiftType: 'double', totalDuties: 2, isNextDayOut: false }
  },
  {
    name: '5. Double B + C Shift (Afternoon to next morning, e.g. Devaraja S)',
    emp: { inTime: '02:18 pm', outTime: '07:07 am', isNextDayOut: true, designation: 'Electrician' },
    expected: { shiftName: 'B + C Shift Group', shiftCode: 'B+C', shiftType: 'double', totalDuties: 2, isNextDayOut: true }
  },
  {
    name: '6. Double A + C Shift (Morning to next morning, e.g. Goutam)',
    emp: { inTime: '07:36 am', outTime: '07:37 am', isNextDayOut: true, designation: 'Plumber' },
    expected: { shiftName: 'A + C Shift Group', shiftCode: 'A+C', shiftType: 'double', totalDuties: 2, isNextDayOut: true }
  }
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  TEST MATRIX: A, B, C and A+B, B+C, A+C Shift Engine Verification');
console.log('═══════════════════════════════════════════════════════════════\n');

let allPassed = true;
testCases.forEach((tc, idx) => {
  const res = evaluateEmployeeShiftAndLate(tc.emp);
  console.log(`TEST ${tc.name}`);
  console.log(`  Inputs:       In: ${tc.emp.inTime}, Out: ${tc.emp.outTime}, isNextDayOut: ${Boolean(tc.emp.isNextDayOut)}`);
  console.log(`  Output Shift: ${res.shiftName} (${res.shiftCode}) [${res.totalDuties} DUTY]`);
  console.log(`  Shift Timing: ${res.shiftTiming}`);
  console.log(`  Hours / OT:   ${res.workingHours} | OT: ${res.otHours}`);
  console.log(`  Late:         ${res.lateMinutes} mins`);

  let passed = true;
  for (const [k, v] of Object.entries(tc.expected)) {
    if (res[k] !== v) {
      console.error(`  ❌ Mismatch for ${k}: expected ${v}, got ${res[k]}`);
      passed = false;
      allPassed = false;
    }
  }
  if (passed) {
    console.log(`  ✅ PASSED\n`);
  } else {
    console.log(`  ❌ FAILED\n`);
  }
});

if (allPassed) {
  console.log('🎉 ALL 6 SHIFT PATTERNS (A, B, C, A+B, B+C, A+C) PASSED PERFECTLY!');
} else {
  console.error('💥 Some test cases failed!');
  process.exit(1);
}
