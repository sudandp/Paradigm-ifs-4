import fs from 'fs';

async function test() {
  const res = await fetch('http://localhost:5173/api/mssql-attendance?date=2026-09-27&siteId=all');
  const data = await res.json();
  const emps = data.employees || [];

  const utopia = emps.filter(e => e.department === 'Brigade Cornerstone Utopia');
  const active = utopia.filter(e => e.isActiveEmployee !== false);
  const present = active.filter(e => e.inTime && e.inTime !== '—');

  // Deployed positions from designation deployment: 89
  const deployed = 89;
  const pCount = present.length; // 58
  const aCount = Math.max(0, deployed - pCount); // 31
  const woCount = Math.max(0, active.length - deployed); // 123
  const rate = Math.round((pCount / deployed) * 100); // 65%

  console.log({
    site: 'Brigade Cornerstone Utopia',
    totalActiveRoster: active.length,
    sanctionedDeployment: deployed,
    present: pCount,
    absent: aCount,
    weeklyOff: woCount,
    attendanceRate: rate + '%'
  });
}
test();
