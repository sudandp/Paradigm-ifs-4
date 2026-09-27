import fetch from 'node-fetch';

async function checkSiteFetch() {
  const url = 'http://localhost:5173/api/mssql-attendance-report?startDate=2026-09-01&endDate=2026-09-30&site=Brigade%20Cornerstone%20Utopia';
  console.log('Fetching:', url);
  const res = await fetch(url);
  const json = await res.json();
  console.log('Success:', json.success, 'Total emps:', json.totalEmployees);
  const emp31049 = json.records?.['31049'] || Object.values(json.records || {}).find(r => r.empCode == '31049');
  console.log('Found 31049?', !!emp31049);
  console.log('Day 25:', emp31049?.days?.['2026-09-25']);
  console.log('Day 26:', emp31049?.days?.['2026-09-26']);
  console.log('Day 27:', emp31049?.days?.['2026-09-27']);
}

checkSiteFetch();
