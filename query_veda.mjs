import sql from "mssql";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

const attempts = [
  { server: "localhost", port: 1433, instanceName: undefined },
  { server: "localhost", port: 1434, instanceName: undefined },
  { server: "localhost", port: 1433, instanceName: "SQLEXPRESS" },
  { server: ".", port: 1433, instanceName: "SQLEXPRESS" },
  { server: ".", port: 0, instanceName: "SQLEXPRESS" },
];

for (const a of attempts) {
  try {
    const cfg = {
      server: a.server,
      database: "etimetracklite1",
      user: "sa",
      password: process.env.MSSQL_PASSWORD || "",
      port: a.port || undefined,
      options: { encrypt: false, trustServerCertificate: true, instanceName: a.instanceName },
      connectionTimeout: 3000,
    };
    const pool = await new sql.ConnectionPool(cfg).connect();
    console.log("CONNECTED: " + a.server + " port=" + a.port + " instance=" + (a.instanceName||"none"));
    const r = await pool.request().query("SELECT TOP 3 EmployeeId, AttendanceDate, InTime, OutTime, Status FROM dbo.AttendanceLogs WHERE EmployeeId = 31014 AND AttendanceDate >= '2026-09-01' ORDER BY AttendanceDate");
    console.log("Rows: " + r.recordset.length);
    r.recordset.forEach(row => console.log(JSON.stringify(row)));
    await pool.close();
    process.exit(0);
  } catch(e) { console.log("Fail [" + a.server + ":" + a.port + "/" + (a.instanceName||"") + "]: " + e.message.substring(0,80)); }
}
console.log("All failed");
