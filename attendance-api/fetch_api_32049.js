const http = require('http');

http.get('http://localhost:4000/api/mssql-attendance?date=2026-08-05&siteId=all', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const emp = parsed.employees.find(e => e.empCode === '32049');
      console.log('--- 32049 TODAY API RECORD ---');
      console.log(emp);
    } catch (e) {
      console.error('Parse error:', e, data.substring(0, 300));
    }
  });
}).on('error', (err) => {
  console.error('Fetch error:', err.message);
});
