# Supabase Attendance Engine Implementation Plan

## Goal
Transition attendance processing from MS SQL (eTimeTrackLite) into Supabase & the App engine, implementing all 7 prioritized scenario rules on `biometric_device_logs` and `processed_attendance`.

## Architecture Flow
```
[eTimeTrackLite1: dbo.DeviceLogs]
       │
       ▼ (Lightweight raw punch stream)
[Supabase: public.biometric_device_logs]
       │
       ▼ (7 Prioritized Scenario Rules in TS & Supabase SQL)
[Supabase: public.processed_attendance]
       │
       ▼ (Real-time sync & offline cache)
[app.paradigmfms.com Frontend UI & Client Dashboard]
```

## Setup & Migration
All database tables, schema extensions, rotational weekly off roster, and the native 7-rule RPC function are consolidated into **one single script**:
- [`sql/setup_supabase_attendance_engine.sql`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/sql/setup_supabase_attendance_engine.sql)

## Tasks
- [x] Task 1: Enhance `public.processed_attendance` Supabase schema (`sql/create_processed_attendance.sql`) with double-shift, W/P, duty count, and audit columns → Verified: Non-destructive migration created with `shift_type`, `total_duties`, `is_weekly_off`, `rule_applied`, `raw_punch_count`, `remarks`.
- [x] Task 2: Create Supabase `public.staff_weekly_off` roster table & seed 17 HK employees' staggered rotational off days → Verified: Included in setup SQL.
- [x] Task 3: Upgrade `utils/deviceLogProcessor.ts` to implement the 36-hour rolling window engine covering R1/R6 (C-shift overnight stitching), R2 (A+B / B+C double shifts), R3 (timing conflicts), R4 (dynamic W/O), and R5 (W/P duty crediting) → Verified: Test suite executed with 100% pass rate on all target scenarios.
- [x] Task 4: Add Supabase Edge / RPC trigger `process_daily_attendance` so attendance calculates automatically inside Supabase → Verified: Included in setup SQL.
- [x] Task 5: Connect `services/api.ts` and `pages/admin/DeviceLogsPage.tsx` to read/write enhanced `processed_attendance` fields with W/P and double-duty KPI metrics → Verified: Type check passed cleanly with 0 compilation errors.

## Done When
- [x] Raw punches flow into `biometric_device_logs`.
- [x] Night shifts (20:46 to 07:16) stitch into one C-shift without ghost records.
- [x] Double shifts (A+B, B+C) compute 2 full duties and correct OT.
- [x] Rotational weekly off days (Mon-Sat) override default Sunday W/O.
- [x] Frontend displays clean attendance directly from Supabase.
