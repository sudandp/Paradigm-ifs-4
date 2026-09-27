import fetch from 'node-fetch';

async function testSimulate() {
  const res = await fetch('http://localhost:5173/api/mssql-attendance-report?startDate=2026-09-01&endDate=2026-09-30&site=all');
  const data = await res.json();
  const emp = data.records?.['31049'] || Object.values(data.records || {}).find(r => r.empCode == '31049');
  const liveMssqlDay = emp.days['2026-09-26'];
  console.log('liveMssqlDay 2026-09-26:', liveMssqlDay);

  const empShift = 'A';
  const isSecGuardNoWO = false;

  let rawIn = liveMssqlDay.inTime && !['—', '-', 'null', 'undefined', '2026-'].includes(liveMssqlDay.inTime.trim()) ? liveMssqlDay.inTime : null;
  let rawOut = liveMssqlDay.outTime && !['—', '-', 'null', 'undefined', '2026-'].includes(liveMssqlDay.outTime.trim()) ? liveMssqlDay.outTime : null;

  const hasOutSE = String(liveMssqlDay.punchRecords || '').includes('out(SE)');
  console.log('hasOutSE:', hasOutSE, 'rawIn:', rawIn, 'rawOut:', rawOut);

  // Check what wasHandoverReconciled does
  let wasHandoverReconciled = false;
  if ((!rawOut || hasOutSE) && rawIn) {
    const inM = 7 * 60 + 13; // 07:13
    console.log('inM:', inM, 'is between 11:30 and 16:00?', inM >= 11 * 60 + 30 && inM <= 16 * 60);
  }

  // Look at lines 3756-3770: isFutureDay!
  const now = new Date();
  const year = 2026;
  const month = 8; // September
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month;
  const dayNum = 26;
  const isFutureDay = isCurrentMonth && dayNum > now.getDate();
  console.log('now:', now.toISOString(), 'getDate():', now.getDate(), 'isCurrentMonth:', isCurrentMonth, 'isFutureDay for 26:', isFutureDay);
}

testSimulate();
