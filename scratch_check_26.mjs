import fetch from 'node-fetch';

async function test26() {
  console.log('--- 1. Querying /api/mssql-attendance-report for 2026-09-26 ---');
  const resReport = await fetch('http://localhost:5173/api/mssql-attendance-report?startDate=2026-09-25&endDate=2026-09-27&site=all');
  const repData = await resReport.json();
  const emp31049 = repData.records?.['31049'] || Object.values(repData.records || {}).find(r => r.empCode == '31049' || r.empName?.includes('Bir Bahadar'));
  console.log('Report 31049 days:');
  console.log('2026-09-25:', emp31049?.days?.['2026-09-25']);
  console.log('2026-09-26:', emp31049?.days?.['2026-09-26']);
  console.log('2026-09-27:', emp31049?.days?.['2026-09-27']);

  console.log('\n--- 2. Querying /api/mssql-device-logs for 31049 on 2026-09-26 ---');
  const resLogs = await fetch('http://localhost:5173/api/mssql-device-logs?date=2026-09-26&empCode=31049&raw=true');
  const logData = await resLogs.json();
  console.log('2026-09-26 Device Logs:', logData.punches);

  console.log('\n--- 3. Querying /api/mssql-device-logs for ALL punches on 2026-09-26 ---');
  const resAllLogs = await fetch('http://localhost:5173/api/mssql-device-logs?date=2026-09-26&raw=true');
  const allLogData = await resAllLogs.json();
  console.log('Total punches on 2026-09-26:', allLogData.punches?.length);
}

test26();
