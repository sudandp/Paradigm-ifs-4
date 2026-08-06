# Site Attendance Server Sync & Deployment Reference

> **Quick Reference for Server Sync & Supabase Setup**
> Local Workspace Path: `e:\backup\onboarding all files\Paradigm Office 4\`
> Attendance API Folder: `attendance-api\`

---

## 1. Files to Copy to Server (`C:\attendance-api\` on `WIN-0T8N581GN63`)

Copy the following files from Dev PC `attendance-api\` to Server PC `C:\attendance-api\`:

1. **`server.js`** — Main Express server & attendance API endpoints.
2. **`package.json`** & **`package-lock.json`** — Required Node dependencies.
3. **`migrations/001_supabase_shift_schema.sql`** — Database schema migration for Supabase.
4. **`.env`** — Contains DB connection credentials, API Key, and Supabase URL/Key.
5. **Batch files**: `setup.bat`, `start.bat`, `cloudflared-setup.bat`.

> ⚠️ **Note**: Do NOT copy `node_modules`. Run `npm install` or `setup.bat` on the server machine.

---

## 2. Server `.env` Configuration

Make sure `C:\attendance-api\.env` on the server includes Supabase credentials:

```env
PORT=4000
DB_NAME=etimetracklite1
DB_USER=sa
DB_PASSWORD=Paradigm@1610
DB_INSTANCE=SQLEXPRESS
DB_PORT=1433
DB_TRUSTED=false

API_SECRET=paradigm-attendance-secret-2024
SUPABASE_URL=https://fmyafuhxlorbafbacywa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1...
```

---

## 3. Supabase Schema Migration (Shift Rules & Attendance Logic)

To save shift rules and attendance logic in Supabase:
1. Open Supabase Dashboard → **SQL Editor**.
2. Run `attendance-api/migrations/001_supabase_shift_schema.sql`.
3. This creates:
   - `shift_master` (Shift definitions & timings)
   - `role_sequence_rules` (Allowed shift transitions & double shift limits)
   - `employee_roster` (Daily employee-to-shift assignments)
   - `duty_instance` (Real-time shift state machine tracking duty status)
   - `exception_queue` (Missed IN / Missed OUT / Wrong pairing exceptions)
   - `user_site_permissions` (Client user site access permissions)
