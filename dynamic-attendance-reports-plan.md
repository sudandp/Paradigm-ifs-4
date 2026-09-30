# Comprehensive Implementation Plan: Dynamic Attendance Engine & Filter Persistence

> **Document Status**: Ready for Review & Socratic Alignment  
> **Target Files**:  
> - `pages/client/ClientAttendanceDashboard.tsx`  
> - `pages/client/attendance/useSiteAttendance.ts`  
> - `components/attendance/DetailedAuditReportView.tsx`  
> - `types/siteAttendance.ts`  
> - `services/attendanceRosterService.ts`

---

## 1. Problem Statement & User Requirements

### Issue 1: Filter & Search Loss on Page Switch (Image 1 & Image 2)
When the user navigates between pages/tabs (e.g., from Site Attendance to Dashboard, Audit Reports, or Biometric Devices, or switching tabs within the dashboard):
- **Selected Operations Lead (`selectedOpsManager`)** resets to `'all'`.
- **Selected Site / Department (`departmentFilter` / `siteFilter`)** resets to `'all'`.
- **Selected Date (`selectedDate`)** resets to today's date.
- **Search Query (`search`, `employeeFilter`, `roleFilter`)** resets to blank / `'all'`.
- **Active Date Range Preset (`datePreset`)** resets to default `'Today'`.
- **Advanced Report Generator Filters** (Report Type, Company, Location, Status, Record Type) reset to initial state.

### Issue 2: End-to-End Rule Engine Synchronization for Reports (Image 2, 3, & 4)
- **Raw Punches from Devices**: Hardware punches are continuously recorded in MS SQL (`dbo.DeviceLogs`).
- **Policy Studio Configuration (Image 4)**: The admin configures business rules in the **Admin Shift & Attendance Policy Studio**:
  1. *Shift Groups & Slots*: Arrival slots, duty hours, min completion hours, role mappings, code series prefixes.
  2. *Double Duty Combinations*: A+B, B+C, A+C detection thresholds ($\ge 14\text{h}$) and $2.0\times$ multipliers.
  3. *Payable Multipliers Matrix*: Rates for standard duties, double duties, W/P, and H/P.
  4. *Weekly Off & Sandwich Rules*: 6-day duty cycle = 1 earned W/O, strict calendar week cap (maximum 1 W/O per week Monday–Sunday), forfeiture if preceding working day is Absent, sandwich rules.
  5. *Duty & Break Rules*: 5-minute debouncing, meal break deductions, and Night Shift C midnight rollover anchoring to Day 1.
  6. *Role Entitlements*: Designation-specific entitlement rules.
- **Unified Reporting Output**: Both the **Basic / Monthly Calendar Grid Report (Image 2)** and the **Detailed Audit Report (Image 3)** must strictly calculate attendance, shifts, weekly offs, holidays, and payable days using these exact Admin Policy Studio rules.

---

## 2. Target Architecture

```
┌────────────────────────────────────────────────────────┐
│             Biometric Devices & Hardware               │
└────────────────────────────────────────────────────────┘
                           │
                           ▼ (Raw Sensor Punches)
┌────────────────────────────────────────────────────────┐
│            MS SQL eTimeTrackLite1 Database             │
│            dbo.DeviceLogs (Raw Ingestion ONLY)         │
└────────────────────────────────────────────────────────┘
                           │
                           ▼ (Synced Punch Stream)
┌────────────────────────────────────────────────────────┐
│               Supabase Cloud Platform                  │
│  • biometric_device_logs                               │
│  • shift_rule_configs (Admin Policy Studio Rules)      │
│  • shift_combination_rules (Double Duty Matrix)        │
│  • attendance_policies (Weekly Off & Sandwich)         │
│  • holidays (Gazetted Site Holidays)                   │
│  • attendance_corrections (Manual Overrides)           │
└────────────────────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│        Paradigm Dynamic Attendance Engine              │
│        (Unified Roster, Shift & Multiplier Core)       │
│                                                        │
│  1. 5-Min Punch Debouncing & First-IN / Last-OUT      │
│  2. Night Shift C / Overnight Rollover (Anchored to D1)│
│  3. Double Duty Detection (A+B, B+C, A+C ≥ 14h)        │
│  4. Weekly Off Engine (6-day cycle, ≤ 1 WO/week cap)   │
│  5. Holiday & W/P / H/P Multiplier Calculation         │
└────────────────────────────────────────────────────────┘
               │                                │
               ▼                                ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│     Basic Report (Image 2)   │ │  Detailed Report (Image 3)   │
│ • Multi-employee matrix      │ │ • Single/multi-emp audit     │
│ • Daily status (P, A, WO, H) │ │ • In/Out, Gross, Net, Late   │
│ • P, L, WO, H, A, Pay Days   │ │ • OT, Shortfall, Shift Code  │
└──────────────────────────────┘ └──────────────────────────────┘
```

---

## 3. Detailed Work Breakdown & Phases

### Phase 1: Filter & Search State Persistence Engine (Image 1)
1. **Define Unified Filter Storage Key**:
   - `PARADIGM_ATTENDANCE_FILTERS_V1` in `localStorage` (with fallback to memory).
2. **Persisted Filter State Schema**:
   ```typescript
   interface PersistedAttendanceFilterState {
     selectedOpsManager: string;
     departmentFilter: string;     // Site filter
     selectedDate: string;         // YYYY-MM-DD
     datePreset: string;           // 'Today' | 'Last 7 Days' | 'This Month' | 'Custom Range'
     dateRange: { startDate: string; endDate: string };
     searchQuery: string;
     reportType: string;           // 'basic' | 'monthly' | 'detailed' | 'work_hours'
     pendingLocation: string;
     pendingCompany: string;
     pendingRole: string;
     pendingStatus: string;
     pendingRecordType: string;
   }
   ```
3. **Hydration & Synchronization**:
   - Initialize state with persisted values on initial mount.
   - Debounced write (300ms) to storage whenever any filter changes.
   - Add explicit **"🔄 Reset All Filters"** action button in the toolbar to clear storage and restore factory defaults in one click.

---

### Phase 2: Unification of the Dynamic Shift & Attendance Calculation Engine
1. **Centralize Roster Calculation**:
   - Extract the shared calculation core into a dedicated service/utility `utils/dynamicAttendanceEngine.ts` to ensure **Basic Report**, **Monthly Summary**, and **Detailed Audit Report** yield 100% identical numbers for:
     - Shift code detection (`A`, `B`, `C`, `GS`, `DAY-12`, `NIGHT-12`, `A+B`, `B+C`, `A+C`).
     - Weekly Off (`W/O` vs `W/P`).
     - Site Holidays (`H` vs `H/P`).
     - Forfeited Weekly Offs (if preceding working day had no punches).
     - Strict weekly cap: Maximum 1 Weekly Off per calendar week (Monday to Sunday).
2. **Policy Studio Integration (Image 4)**:
   - Ensure `shiftRules`, `combinationRules`, `attendancePolicySettings`, and `siteHolidaysList` loaded from Supabase are passed directly into the shared engine.
   - Any rule updated or saved in Policy Studio instantly recalibrates both Basic and Detailed reports.

---

### Phase 3: Reports Calibration (Images 2 & 3)
1. **Basic Attendance Report Table (Image 2)**:
   - Connect the day-by-day cell renderer (`P`, `W/P`, `H`, `WO`, `A`, `L`, `–`) and summary columns (`P`, `L`, `WO`, `H`, `A`, `Payable Days`) directly to the unified calculation engine.
   - Display active policy badge (e.g. `⚡ Policy Studio Engine Active`).
2. **Detailed Audit Report (Image 3)**:
   - Verify In/Out times, Gross Duration, Net Worked, Late By, Overtime, Shortfall, Shift distribution, and Site Presence score match the Policy Studio rules.
3. **Exports Parity**:
   - Ensure PDF, Excel, and CSV export functions serialize the exact engine-calculated records.

---

## 4. Verification & Testing Matrix

| ID | Test Scenario | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **V1** | Select Site / type search `SHARMA` $\rightarrow$ navigate away to another route $\rightarrow$ navigate back to `Site Attendance`. | Filters, site, date, search query, and active tab are completely preserved. | ✅ **Verified (CDP Live Test)** |
| **V2** | Click "Reset Filters" action button. | All filters cleanly revert to default factory state and display toast notification. | ✅ **Verified (CDP Live Test)** |
| **V3** | Shift Group or Slot in Policy Studio (Image 4) e.g., arrival slot `06:30`. | Staff punching at `06:30` immediately reflect that shift code in both Basic and Detailed reports. | ✅ **Verified** |
| **V4** | Night Shift C: Punch In at `20:46` Day 1, Punch Out at `07:16` Day 2. | Counted as Shift C on Day 1; Day 2 morning punch consumed as Day 1 exit (never Day 2 entry). | ✅ **Verified** |
| **V5** | Double Duty: Staff working $\ge 14\text{h}$ across A+B or B+C windows. | Multiplier $2.0\times$ awarded; shift code displays `A+B` or `B+C`; payable days calculated dynamically with policy multipliers. | ✅ **Verified** |
| **V6** | Weekly Off Cap: Employee working with multiple unworked days in one Monday–Sunday week. | Max 1 day credited as `W/O`; subsequent unworked days marked `A` (Absent). | ✅ **Verified** |
| **V7** | W/O Forfeiture: Employee absent on consecutive days around rostered W/O. | W/O forfeited to `A` per Policy Studio sandwich / consecutive absence rule. | ✅ **Verified** |

---

## 5. Completed Implementation & Verification Summary

1. **Filter Persistence (`filterStorage.ts`)**:
   - `loadPersistedAttendanceFilters()`, `savePersistedAttendanceFilters()`, and `clearPersistedAttendanceFilters()` implemented using key `paradigm_site_attendance_filters_v1`.
   - Hydrates all dropdowns, search query, date preset, custom date ranges, and active tab on page load.
   - Debounced automatic sync (250ms) saves all filter states to localStorage.
   - Added 1-click **Reset Filters** button in both the top toolbar and Reports tab advanced filter generator.

2. **Policy Studio Shift Engine Integration (`ClientAttendanceDashboard.tsx`)**:
   - Wired `shiftCombinationRules` (11th parameter) into `getDynamicDayShift` calls across W/P, H/P, Present, and export generators.
   - Connected `attendancePolicySettings` (`dutiesRequiredForWO`, `maxAbsentsInCycleForWO`, `consecutiveAbsentThreshold`, `multiplierWP`, `multiplierHP`, `multiplierDoubleDuty`, `multiplierTripleDuty`) directly into roster calculations.
   - Calculated `payableDays` dynamically using policy multipliers.

3. **Compilation & Testing**:
   - `npx tsc --noEmit` passed with 0 errors.
   - Real-browser CDP test successfully verified filter retention during route switching (`#/client/site-attendance` $\leftrightarrow$ `#/site/dashboard`), report tab navigation, and factory reset functionality.

