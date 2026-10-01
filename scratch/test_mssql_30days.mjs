const dates = [];
for (let d = 1; d <= 30; d++) {
  const dStr = d < 10 ? `0${d}` : `${d}`;
  dates.push(`2026-09-${dStr}`);
}

async function fetchInChunks(dates, chunkSize = 5) {
  const results = [];
  const t0 = Date.now();
  console.log(`Starting fetch of ${dates.length} days from MSSQL (chunks of ${chunkSize})...`);
  
  for (let i = 0; i < dates.length; i += chunkSize) {
    const chunk = dates.slice(i, i + chunkSize);
    console.log(`Fetching chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(dates.length / chunkSize)}: ${chunk.join(', ')}`);
    const chunkResults = await Promise.all(chunk.map(async (d) => {
      try {
        const r = await fetch(`https://attendance.cctv.rest/attendance?date=${d}&siteId=all`, {
          headers: {
            'x-api-key': 'paradigm-attendance-secret-2024',
            'x-api-secret': 'paradigm-attendance-secret-2024',
            'Bypass-Tunnel-Reminder': '1',
          },
          signal: AbortSignal.timeout(15000),
        });
        if (r.ok) {
          const j = await r.json();
          return { date: d, employees: j.employees || [] };
        }
      } catch (err) {
        console.error(`Error on ${d}:`, err.message);
      }
      return { date: d, employees: [] };
    }));
    results.push(...chunkResults);
  }
  
  console.log(`Completed ${results.length} days in ${Date.now() - t0}ms`);
  
  // Utopia count check
  const utopiaCodes = new Set();
  results.forEach(res => {
    res.employees.forEach(e => {
      const c = String(e.empCode || '');
      if (c.startsWith('31') || c.startsWith('32')) utopiaCodes.add(c);
    });
  });
  console.log(`Total unique Utopia employees found across September 2026 in MSSQL: ${utopiaCodes.size}`);
}

fetchInChunks(dates, 6);
