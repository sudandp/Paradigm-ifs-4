# Paradigm Office - Work Laptop Productivity & Exclusive Registration Companion

This companion agent enables work laptop productivity tracking and enforces strict **1-Laptop-to-1-User Exclusive Registration**.

---

## Key Features

1. **Active Application & Window Tracking**:
   - Samples active foreground window every 10 seconds.
   - Automatically categorizes into **Development**, **Browsing**, **Communication**, **Productivity**, **Design**, and **Utility**.
   - Aggregates daily active time vs. idle time.

2. **Strict 1-Laptop-to-1-User Security**:
   - Machine hardware UUID (`(Get-CimInstance Win32_ComputerSystemProduct).UUID` on Windows / `IOPlatformUUID` on macOS) is registered to the employee.
   - If another employee tries to use this machine or run the agent, access is **instantly blocked**.
   - Prevents unauthorized device sharing or proxy attendance.

3. **Active Shift Bound**:
   - Only tracks while an employee is clocked in on Paradigm attendance.
   - Pauses automatically during breaks or after punch-out.

---

## Quick Start

### Option A: Windows Standalone (No Node.js needed)
Open PowerShell or Command Prompt in this folder and run:
```powershell
.\run-agent.bat --email=your-email@paradigmfms.com
```

### Option B: Node.js (Cross-Platform Windows / Mac / Linux)
```bash
npm install
npm start -- --email=your-email@paradigmfms.com
```
Or with specific user ID:
```bash
npm start -- --user=3b4d1b84-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## Database Schema
The server-side database migration is in:
`supabase/migrations/20260913_laptop_productivity_and_binding.sql`
Run this SQL script in your Supabase SQL Editor to enable tables:
- `user_devices.hardware_uuid` & `user_devices.is_exclusive_laptop`
- `laptop_app_usage_logs`
- `daily_laptop_productivity_summary`
