import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const candidateBaseUrls: string[] = [
    'https://attendance.cctv.rest',
    'https://attendance.paradigmfms.com',
    (process.env.MSSQL_PROXY_URL || '').replace(/\/$/, ''),
  ].filter(Boolean);

  // Dynamic fallback: auto-detect live attendance Cloudflare tunnel URL from Supabase cctv_devices
  try {
    const sbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
    const sbKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU';
    const sbRes = await fetch(`${sbUrl}/rest/v1/cctv_devices?select=device_secret&order=updated_at.desc&limit=1`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
      signal: AbortSignal.timeout(2000),
    });
    if (sbRes.ok) {
      const data = await sbRes.json();
      if (Array.isArray(data) && data[0]) {
        const attLive = data[0].device_secret?.replace(/\/$/, '');
        if (attLive && attLive.startsWith('http') && !candidateBaseUrls.includes(attLive)) {
          candidateBaseUrls.unshift(attLive);
        }
      }
    }
  } catch (error) {
    // Ignore dynamic endpoint lookup failure and proceed with candidateBaseUrls
    void error;
  }

  const apiSecret = process.env.MSSQL_API_SECRET || 'paradigm-attendance-secret-2024';
  const action = (req.query.action as string) || 'attendance';

  // 1. Devices Endpoint
  if (action === 'devices' || req.url?.includes('mssql-devices')) {
    const endpoints: string[] = [];
    for (const base of candidateBaseUrls) {
      endpoints.push(`${base}/devices`);
      endpoints.push(`${base}/api/devices`);
    }

    for (const targetUrl of endpoints) {
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'x-api-secret': apiSecret,
            'x-api-key': apiSecret,
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true',
            'Bypass-Tunnel-Reminder': '1',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          const data = await response.json();
          return res.status(200).json(data);
        }
      } catch (error) {
        // Fall through to next candidate endpoint
        void error;
      }
    }
    return res.status(200).json({ devices: [], total: 0, online: 0, offline: 0 });
  }

  // 2. Update Employee Endpoint
  if (action === 'update-employee' || req.url?.includes('mssql-update-employee')) {
    const endpoints: string[] = [];
    for (const base of candidateBaseUrls) {
      endpoints.push(`${base}/update-employee`);
      endpoints.push(`${base}/api/update-employee`);
      endpoints.push(`${base}/api/mssql-update-employee`);
    }

    for (const targetUrl of endpoints) {
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'x-api-secret': apiSecret,
            'x-api-key': apiSecret,
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true',
            'Bypass-Tunnel-Reminder': '1',
          },
          body: JSON.stringify(req.body),
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok) {
          const data = await response.json();
          return res.status(200).json(data);
        }
      } catch (error) {
        // Fall through to next candidate endpoint
        void error;
      }
    }
    return res.status(500).json({ success: false, error: 'Could not connect to MS SQL update proxy endpoint' });
  }

  // 2.5 Multi-day Attendance Report Endpoint
  if (action === 'attendance-report' || req.url?.includes('mssql-attendance-report')) {
    const startDate = req.query.startDate || new Date().toISOString().slice(0, 8) + '01';
    const endDate = req.query.endDate || new Date().toISOString().slice(0, 10);
    const siteId = req.query.site || req.query.siteId || 'all';
    const empCode = req.query.empCode || '';

    const endpoints: string[] = [];
    for (const base of candidateBaseUrls) {
      endpoints.push(`${base}/attendance-report?startDate=${encodeURIComponent(String(startDate))}&endDate=${encodeURIComponent(String(endDate))}&site=${encodeURIComponent(String(siteId))}&empCode=${encodeURIComponent(String(empCode))}`);
      endpoints.push(`${base}/api/attendance-report?startDate=${encodeURIComponent(String(startDate))}&endDate=${encodeURIComponent(String(endDate))}&site=${encodeURIComponent(String(siteId))}&empCode=${encodeURIComponent(String(empCode))}`);
    }

    for (const targetUrl of endpoints) {
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'x-api-secret': apiSecret,
            'x-api-key': apiSecret,
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true',
            'Bypass-Tunnel-Reminder': '1',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const data: any = await response.json();
          const recCount = data?.records ? Object.keys(data.records).length : (data?.totalEmployees || 0);
          if (recCount > 0) {
            // Validate that returned records cover the entire requested date range
            const expectedDates: string[] = [];
            const curD = new Date(String(startDate));
            const endD = new Date(String(endDate));
            while (curD <= endD) {
              expectedDates.push(curD.toISOString().slice(0, 10));
              curD.setDate(curD.getDate() + 1);
            }

            const sampleEmpList = Object.values(data.records || {}) as any[];
            const missingDates = expectedDates.filter(d => {
              const utopiaSample = sampleEmpList.find(e => {
                const c = String(e.empCode || '');
                const dept = String(e.department || '').toLowerCase();
                return c.startsWith('31') || c.startsWith('32') || dept.includes('utopia');
              });
              if (utopiaSample && !utopiaSample.days?.[d]) return true;
              const countWithDate = sampleEmpList.filter(e => e.days?.[d]).length;
              return countWithDate === 0 || countWithDate < Math.max(5, sampleEmpList.length * 0.15);
            });

            if (missingDates.length > 0) {
              const liveBase = candidateBaseUrls[0] || 'https://attendance.cctv.rest';
              const missingResults = await Promise.all(missingDates.map(async (d) => {
                try {
                  const r = await fetch(`${liveBase}/attendance?date=${d}&siteId=all`, {
                    headers: { 'x-api-key': apiSecret, 'x-api-secret': apiSecret, 'Bypass-Tunnel-Reminder': '1' },
                    signal: AbortSignal.timeout(12000),
                  });
                  if (r.ok) {
                    const j: any = await r.json();
                    return { date: d, employees: j.employees || [] };
                  }
                } catch (_) {}
                return { date: d, employees: [] };
              }));

              missingResults.forEach(({ date, employees }) => {
                employees.forEach((emp: any) => {
                  const code = String(emp.empCode || '').trim();
                  if (!data.records[code]) {
                    data.records[code] = {
                      empCode: code,
                      empName: emp.empName,
                      department: emp.department,
                      designation: emp.designation,
                      days: {},
                      summary: { presentDays: 0, absentDays: 0, woDays: 0, lateDays: 0, totalNetMins: 0, totalOtMins: 0 },
                    };
                  }
                  if (!data.records[code].days[date]) {
                    const isPres = emp.status === 'Present' || (emp.inTime && emp.inTime !== '—');
                    const isLate = emp.status === 'Late' || (emp.lateMinutes && emp.lateMinutes > 0);
                    let statusStr = 'A';
                    if (isPres) statusStr = 'P';
                    else if (isLate) statusStr = 'L';

                    data.records[code].days[date] = {
                      dateStr: date,
                      inTime: emp.inTime || '—',
                      outTime: emp.outTime || '—',
                      hours: emp.workingHours && emp.workingHours !== '—' ? emp.workingHours : (isPres ? '9h 00m' : '—'),
                      status: statusStr,
                      isWeeklyOff: false,
                      lateMinutes: emp.lateMinutes || 0,
                    };
                  }
                });
              });

              Object.values(data.records).forEach((r: any) => {
                if (r.days) {
                  const allDays = Object.values(r.days) as any[];
                  r.summary = {
                    presentDays: allDays.filter(d => d.status === 'P' || d.status === 'L').length,
                    absentDays: allDays.filter(d => d.status === 'A').length,
                    woDays: allDays.filter(d => d.status === 'WO' || d.status === 'W/O' || d.isWeeklyOff).length,
                    lateDays: allDays.filter(d => d.status === 'L' || d.lateMinutes > 0).length,
                    totalNetMins: allDays.reduce((acc, d) => acc + (d.durationMins || d.netMins || 0), 0),
                    totalOtMins: allDays.reduce((acc, d) => acc + (d.otMins || 0), 0),
                  };
                }
              });
            }

            // Sanitize any truncated '2026-' inTime/outTime using punchRecords
            Object.values(data.records).forEach((r: any) => {
              if (r.days) {
                Object.values(r.days).forEach((d: any) => {
                  if ((d.inTime === '2026-' || d.outTime === '2026-') && d.punchRecords) {
                    const punches = [...String(d.punchRecords).matchAll(/(\d{1,2}:\d{2})/g)].map(m => m[1]);
                    if (punches.length > 0) {
                      d.inTime = punches[0];
                      d.outTime = punches[punches.length - 1];
                    }
                  }
                });
              }
            });

            return res.status(200).json(data);
          }
        }
      } catch (error) {
        void error;
      }
    }

    // Resilient Fallback: Multi-date aggregator via live /attendance?date=
    const dates: string[] = [];
    const cur = new Date(String(startDate));
    const endD = new Date(String(endDate));
    while (cur <= endD) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    const liveBase = candidateBaseUrls[0] || 'https://attendance.cctv.rest';
    const dayResults = await Promise.all(dates.map(async (d) => {
      try {
        const r = await fetch(`${liveBase}/attendance?date=${d}&siteId=all`, {
          headers: { 'x-api-key': apiSecret, 'x-api-secret': apiSecret, 'Bypass-Tunnel-Reminder': '1' },
          signal: AbortSignal.timeout(12000),
        });
        if (r.ok) {
          const j: any = await r.json();
          return { date: d, employees: j.employees || [] };
        }
      } catch {
        // Fallback to empty day results on network or parse failure
      }
      return { date: d, employees: [] };
    }));

    const records: Record<string, any> = {};
    const siteFilterStr = String(siteId).toLowerCase().trim();
    dayResults.forEach(({ date, employees }) => {
      employees.forEach((emp: any) => {
        const code = String(emp.empCode || '').trim();
        const site = String(emp.department || '').trim();

        if (siteFilterStr && siteFilterStr !== 'all') {
          const cSite = site.toLowerCase();
          const matchesSite = cSite.includes(siteFilterStr) || siteFilterStr.includes(cSite);
          const matchesUtopia = siteFilterStr.includes('utopia') && (code.startsWith('31') || code.startsWith('32'));
          if (!matchesSite && !matchesUtopia) return;
        }

        if (!records[code]) {
          records[code] = {
            empCode: code,
            empName: emp.empName,
            department: site,
            designation: emp.designation,
            days: {},
            summary: { presentDays: 0, absentDays: 0, woDays: 0, lateDays: 0, totalNetMins: 0, totalOtMins: 0 },
          };
        }

        const isPres = emp.status === 'Present' || (emp.inTime && emp.inTime !== '—');
        const isLate = emp.status === 'Late' || (emp.lateMinutes && emp.lateMinutes > 0);

        let statusStr = 'A';
        if (isPres) statusStr = 'P';
        else if (isLate) statusStr = 'L';

        if (isPres || isLate) {
          records[code].summary.presentDays++;
          if (isLate) records[code].summary.lateDays++;
        } else {
          records[code].summary.absentDays++;
        }

        const extractHHMM = (t: string | null | undefined) => {
          if (!t || t === '—' || t === '-') return '—';
          const m = String(t).match(/(?:^|[\sT])(\d{1,2}:\d{2})/);
          return m ? m[1] : t;
        };
        records[code].days[date] = {
          dateStr: date,
          inTime: extractHHMM(emp.inTime),
          outTime: extractHHMM(emp.outTime),
          hours: emp.workingHours && emp.workingHours !== '—' ? emp.workingHours : (isPres ? '9h 00m' : '—'),
          status: statusStr,
          isWeeklyOff: false,
          lateMinutes: emp.lateMinutes || 0,
        };
      });
    });

    const empList = Object.values(records);
    return res.status(200).json({
      success: true,
      startDate,
      endDate,
      site: siteId,
      totalEmployees: empList.length,
      records,
      employees: empList,
      lastUpdated: new Date().toISOString(),
    });
  }

  // 3. Attendance Main Query
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const siteId = req.query.siteId || 'all';

  const endpoints: string[] = [];
  for (const base of candidateBaseUrls) {
    endpoints.push(`${base}/attendance?date=${encodeURIComponent(String(date))}&siteId=${encodeURIComponent(String(siteId))}`);
    endpoints.push(`${base}/api/attendance?date=${encodeURIComponent(String(date))}&siteId=${encodeURIComponent(String(siteId))}`);
  }

  let lastError = '';

  for (const targetUrl of endpoints) {
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'x-api-secret': apiSecret,
          'x-api-key': apiSecret,
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
          'Bypass-Tunnel-Reminder': '1',
        },
        signal: AbortSignal.timeout(20000),
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      } else {
        const errorText = await response.text();
        lastError = `[${targetUrl}] HTTP ${response.status}: ${errorText.slice(0, 150)}`;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = `[${targetUrl}] Fetch failed: ${msg}`;
    }
  }

  // ─── 4. Seamless Fallback: Serve from Supabase Hot Cache ───
  try {
    const sbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M';
    const authHeader = (req.headers.authorization as string) || `Bearer ${sbKey}`;

    const cacheRes = await fetch(
      `${sbUrl}/rest/v1/attendance_cache?attendance_date=eq.${encodeURIComponent(String(date))}&limit=5000`,
      {
        headers: {
          apikey: sbKey,
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (cacheRes.ok) {
      const cachedRows = await cacheRes.json();
      if (Array.isArray(cachedRows) && cachedRows.length > 0) {
        let present = 0;
        let absent = 0;
        let late = 0;

        const employees = cachedRows.map((r: any) => {
          const isPres = r.status === 'Present' || (r.in_time && r.in_time !== '—');
          const isLate = (r.late_mins || 0) > 0 || r.status === 'Late';
          if (isPres) present++; else absent++;
          if (isLate) late++;

          return {
            empCode: r.emp_code,
            empName: r.emp_name,
            department: r.department,
            designation: r.designation,
            site: r.site,
            inTime: r.in_time || '—',
            outTime: r.out_time || '—',
            status: r.status,
            statusCode: r.status_code,
            workingHours: r.working_hours || (isPres ? '9h 00m' : '—'),
            shiftCompleted: r.shift_completed || false,
            duration: r.duration_mins || 0,
            lateMinutes: r.late_mins || 0,
            overtimeMinutes: r.ot_mins || 0,
            source: 'supabase_cache',
          };
        });

        const totalEmployees = employees.length;
        const onTime = Math.max(0, present - late);
        const attendanceRate = totalEmployees > 0 ? Math.round((present / totalEmployees) * 100) : 0;

        return res.status(200).json({
          summary: { date, totalEmployees, present, absent, late, onTime, attendanceRate },
          employees,
          trend: [],
          departments: [],
          lastUpdated: new Date().toISOString(),
          connectionStatus: 'connected',
          source: 'supabase_cache',
          cached: true,
        });
      }
    }
  } catch (cacheErr) {
    console.warn('[MSSQL Proxy] Supabase cache fallback failed:', cacheErr);
  }

  return res.status(200).json({
    summary: { date, totalEmployees: 0, present: 0, absent: 0, late: 0, onTime: 0, attendanceRate: 0 },
    employees: [],
    trend: [],
    departments: [],
    lastUpdated: new Date().toISOString(),
    connectionStatus: 'error',
    errorMessage: lastError || `Could not connect to MS SQL proxy (${candidateBaseUrls[0] || 'none'})`,
  });
}
