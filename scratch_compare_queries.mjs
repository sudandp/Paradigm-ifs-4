import fetch from 'node-fetch';

async function checkWhy() {
  console.log('Querying full month 2026-09-01 to 2026-09-30...');
  const resMonth = await fetch('http://localhost:5173/api/mssql-attendance-report?startDate=2026-09-01&endDate=2026-09-30&site=all');
  const dMonth = await resMonth.json();
  const empMonth = dMonth.records?.['31049'];
  console.log('Full month Day 26 for 31049:', empMonth?.days?.['2026-09-26']);

  console.log('\nQuerying short range 2026-09-24 to 2026-09-27...');
  const resShort = await fetch('http://localhost:5173/api/mssql-attendance-report?startDate=2026-09-24&endDate=2026-09-27&site=all');
  const dShort = await resShort.json();
  const empShort = dShort.records?.['31049'];
  console.log('Short range Day 26 for 31049:', empShort?.days?.['2026-09-26']);
}

checkWhy();
