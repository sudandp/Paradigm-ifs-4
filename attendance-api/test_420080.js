const mssql = require('mssql');
require('dotenv').config();

async function test420080() {
  try {
    const pool = await mssql.connect({
      server: 'localhost',
      database: 'etimetracklite1',
      options: { encrypt: false, trustServerCertificate: true, instanceName: 'SQLEXPRESS', trustedConnection: true },
    });

    const date = '2026-08-04';
    const prevDateStr = '2026-08-03';
    const nextDateStr = '2026-08-05';
    const logTable = 'DeviceLogs_8_2026';

    const req = pool.request();
    const queryResult = await req.query(`
      SELECT 
        LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) AS empCode,
        e.EmployeeName                             AS empName,
        ISNULL(d.DepartmentFName, 'General')       AS department,
        ISNULL(e.Designation, 'Staff')             AS designation,
        CONVERT(VARCHAR(19), p.FirstInPunchOnDate, 120)  AS firstInPunchStr,
        CONVERT(VARCHAR(19), p.NightInPunchOnDate, 120)  AS nightInPunchStr,
        CONVERT(VARCHAR(19), p.LastOutPunchOnDate, 120)  AS lastOutPunchStr,
        CONVERT(VARCHAR(19), p.NextMorningOutPunch, 120) AS nextMorningOutPunchStr,
        CONVERT(VARCHAR(19), p.PrevNightInPunch, 120)   AS prevNightInPunchStr
      FROM dbo.Employees e WITH (NOLOCK)
      LEFT JOIN dbo.Departments d WITH (NOLOCK) ON e.DepartmentId = d.DepartmentId
      LEFT JOIN (
        SELECT 
          EmployeeCode,
          MIN(CASE WHEN LogDate >= '${date} 05:30:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS FirstInPunchOnDate,
          MIN(CASE WHEN LogDate >= '${date} 17:00:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS NightInPunchOnDate,
          MAX(CASE WHEN LogDate >= '${date} 00:00:00' AND LogDate <= '${date} 23:59:59' THEN LogDate END) AS LastOutPunchOnDate,
          MIN(CASE WHEN LogDate >= '${nextDateStr} 00:00:00' AND LogDate <= '${nextDateStr} 12:30:00' THEN LogDate END) AS NextMorningOutPunch,
          MAX(CASE WHEN LogDate >= '${prevDateStr} 17:00:00' AND LogDate <= '${prevDateStr} 23:59:59' THEN LogDate END) AS PrevNightInPunch
        FROM (
          SELECT LTRIM(RTRIM(CAST(UserId AS VARCHAR(50)))) AS EmployeeCode, LogDate 
          FROM dbo.[${logTable}] WITH (NOLOCK)
        ) AllPunches
        WHERE LogDate >= '${prevDateStr} 17:00:00' AND LogDate <= '${nextDateStr} 12:30:00'
        GROUP BY EmployeeCode
      ) p ON LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = p.EmployeeCode
      WHERE LTRIM(RTRIM(CAST(e.EmployeeCode AS VARCHAR(50)))) = '420080'
    `);

    const row = queryResult.recordset[0];
    console.log('--- SQL RAW QUERY ROW ---');
    console.log(row);

    const parseSqlStr = (str) => {
      if (!str) return null;
      const parts = String(str).trim().split(' ');
      if (parts.length < 2) return null;
      const dParts = parts[0].split('-').map(Number);
      const tParts = parts[1].split(':').map(Number);
      if (dParts.length < 3 || tParts.length < 3) return null;
      return {
        year: dParts[0],
        month: dParts[1] - 1,
        day: dParts[2],
        hours: tParts[0],
        minutes: tParts[1],
        seconds: tParts[2],
        timestamp: Date.UTC(dParts[0], dParts[1] - 1, dParts[2], tParts[0], tParts[1], tParts[2]),
      };
    };

    const firstIn = parseSqlStr(row.firstInPunchStr);
    const nightIn = parseSqlStr(row.nightInPunchStr);
    const lastOut = parseSqlStr(row.lastOutPunchStr);
    const nextMorningOut = parseSqlStr(row.nextMorningOutPunchStr);
    const prevNightIn = parseSqlStr(row.prevNightInPunchStr);

    let effectiveIn = firstIn;
    if (!effectiveIn || (prevNightIn && firstIn && firstIn.hours < 12)) {
      effectiveIn = nightIn;
    }

    let inTimeStr = null;
    let outTimeStr = null;
    let workingHours = '—';
    let shiftCompleted = false;

    if (effectiveIn) {
      const inH = effectiveIn.hours;
      const inM = effectiveIn.minutes;
      const inAmpm = inH >= 12 ? 'pm' : 'am';
      const displayInH = inH % 12 === 0 ? 12 : inH % 12;
      inTimeStr = `${String(displayInH).padStart(2, '0')}:${String(inM).padStart(2, '0')} ${inAmpm}`;

      let effectiveOut = null;
      if (inH >= 17 && nextMorningOut) {
        effectiveOut = nextMorningOut;
      } else if (lastOut && lastOut.timestamp > effectiveIn.timestamp) {
        const diffMins = Math.floor((lastOut.timestamp - effectiveIn.timestamp) / 60000);
        if (diffMins > 5) {
          effectiveOut = lastOut;
        }
      }

      if (effectiveOut) {
        const outH = effectiveOut.hours;
        const outM = effectiveOut.minutes;
        const outAmpm = outH >= 12 ? 'pm' : 'am';
        const displayOutH = outH % 12 === 0 ? 12 : outH % 12;
        outTimeStr = `${String(displayOutH).padStart(2, '0')}:${String(outM).padStart(2, '0')} ${outAmpm}`;

        const diffMs = effectiveOut.timestamp - effectiveIn.timestamp;
        if (diffMs > 0) {
          const totalMins = Math.floor(diffMs / 60000);
          const h = Math.floor(totalMins / 60);
          const m = totalMins % 60;
          workingHours = `${h}h ${String(m).padStart(2, '0')}m`;
          if (totalMins >= 360) shiftCompleted = true;
        }
      }
    }

    console.log('\n--- CALCULATED ATTENDANCE RECORD ---');
    console.log({
      empCode: row.empCode,
      empName: row.empName,
      inTime: inTimeStr,
      outTime: outTimeStr,
      workingHours,
      shiftCompleted
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test420080();
