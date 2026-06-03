# Edit Rules → Impact on Previous Month Records
## Paradigm Office 4 — Attendance Settings Analysis

---

## 🧠 TL;DR

> **Yes — editing rules CAN affect previous month records, but ONLY if those months are NOT locked.**
> Locked months are completely frozen and protected. Unlocked months will be recalculated with new rules on the next view.

---

## 📐 System Architecture Overview

```
AttendanceSettings (Global / Scoped)
        │
        ├── office: StaffAttendanceRules
        ├── field:  StaffAttendanceRules
        ├── site:   StaffAttendanceRules
        ├── admin?: StaffAttendanceRules
        └── management?: StaffAttendanceRules
```

Rules are stored in 3 places:
| Table | Purpose |
|-------|---------|
| `settings` (singleton) | Live/current rules read by app |
| `attendance_rule_versions` | Versioned history of rule changes |
| `attendance_settings_scopes` | Scoped overrides (location/company/entity) |
| `attendance_month_snapshots` | Frozen locked-month data (bypasses rules) |

---

## 🔄 How Editing Rules Works (Save Flow)

### Global Scope Save → `handleSave()` in [AttendanceSettings.tsx](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/pages/hr/AttendanceSettings.tsx#L458-L486)

```
User clicks "Save Rules"
    │
    ├── Is Global scope? YES
    │       │
    │       └── Opens "Rule Change Impact" Modal
    │               ├── Checks last 6 months → api.isMonthLocked(year, month)
    │               ├── Shows each month as:
    │               │     🔒 Protected (locked) — safe
    │               │     ⚠️  Will recalculate (unlocked) — AFFECTED
    │               └── Admin sets "Effective From" date → doSave()
    │
    └── Is Scoped (location/company/entity)? YES
            └── Saves directly with api.saveScopedAttendanceSettings()
                (No versioning modal — no retroactive impact check)
```

### `doSave()` → [api.saveAttendanceRuleVersion()](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/services/api.ts#L994-L1042)

```
1. Closes previous active version (sets effective_till = effectiveFrom - 1 day)
2. Inserts new version row in attendance_rule_versions
3. Also updates live settings singleton (settings table)
```

---

## 🛡️ Month Protection: Locked vs Unlocked

### Locked Month (Protected ✅)

- Snapshot exists in `attendance_month_snapshots`
- `api.isMonthLocked()` → returns `true`
- **MonthlyHoursReport loads snapshot directly — NO recalculation**
- Rule changes have ZERO effect

### Unlocked Month (Vulnerable ⚠️)

- No snapshot in `attendance_month_snapshots`
- Report is recalculated live on every view
- Uses `api.getRuleVersionForMonth(year, month)` to find which rule version was active
- **If no version found → falls back to CURRENT live rules**

> ⚠️ **Risk:** If you save rules without setting an appropriate `effectiveFrom` date, the new version becomes the "most recent" rule and may be applied to old unlocked months that don't have a matching version.

---

## 📋 What Gets Affected in Previous Months (If Unlocked)

When rules are edited, the following calculations in `processEmployeeMonth()` are directly controlled by `StaffAttendanceRules`:

### 1. 🕐 Daily Attendance Status (`evaluateAttendanceStatus`)
| Rule Field | What Changes |
|-----------|--------------|
| `minimumHoursFullDay` | Threshold for `P` (Present) vs `1/2P` (Half Day) |
| `minimumHoursHalfDay` | Threshold for `1/2P` vs `A` (Absent) |
| `threeQuarterDayHours` | Threshold for `3/4P` status |
| `quarterDayHours` | Threshold for `1/4P` status |
| `weekendPresentThreshold` | Min days in week to earn `W/O` (week off) |
| `weeklyOffDays` | Which days are `W/O` (e.g. Sunday only vs Sat+Sun) |
| `enableHoursBasedFallback` | For field/site: if site tracking returns A but hours exist |
| `enableSiteTimeTracking` | Site vs travel validation for field staff |
| `minimumSitePercentage` | % of time required on-site for site/field staff |
| `minimumSiteHours` | Absolute site hours required |

### 2. 📅 Holiday & Week-Off Counting
| Rule Field | What Changes |
|-----------|--------------|
| `floatingHolidayMonths` | Which months qualify for floating/blue leaves |
| `maxHolidaysPerCategory` | Holiday eligibility limit |
| `recurringHolidays` | Recurring off days (e.g. 3rd Saturday) — changes status for all days in month |
| `enableCustomHolidays` | Whether user-selected pool holidays are active |
| `siteHolidayToggle` | Whether site staff get holiday credit |
| `nhBillingConfig` / `nhSalaryConfig` | National holiday billing behaviour |

### 3. 💰 Payable Days Calculation
| Rule Field | What Changes |
|-----------|--------------|
| `dailyWorkingHours.max` | Max hours before OT kicks in |
| `shiftHours` | Expected hours per shift |
| `enableOtToCompOffConversion` | OT conversion to Comp Off days |
| `otConversionThreshold` | Hours needed for 1 Comp Off |
| `overtimeDays` (site) | Adds +1 payable day if site staff works >14 hours |

### 4. 🗓️ Leave Counts in Summary
| Rule Field | What Changes |
|-----------|--------------|
| `annualEarnedLeaves` | Earned leave eligibility display |
| `annualSickLeaves` | Sick leave quota |
| `monthlyFloatingLeaves` | Floating leave allowance |
| `annualCompOffLeaves` | Comp off limit |
| `maternityLeaveWeeks` | Maternity leave quota |
| `childCareLeaveUnder5` / `childCare5to15` | Child care entitlement |

### 5. 🏗️ Site Staff Specific (Site Tab)
| Rule Field | What Changes |
|-----------|--------------|
| `siteShifts` | Shift detection by punch-in time (Shift GS/B/C) |
| `enableShiftManagement` | Enables multi-shift tracking |
| `siteDepartments` | Department groupings for report |
| `deptRuleConfigs` | Per-department weekly offs, shift assignment |
| `fixedOfficeHours` | Check-in/out time windows |

### 6. 📊 Summary Totals That Change
These totals in `EmployeeMonthlyData` are derived from the above:
- `presentDays`, `absentDays`, `halfDays`, `threeQuarterDays`, `quarterDays`
- `weekOffs`, `holidays`, `floatingHolidays`, `holidayPresents`
- `totalPayableDays` ← **Most critical for salary/billing**
- `totalOT`, `overtimeDays`, `compOffs`
- `lossOfPays`, `workFromHomeDays`
- `averageWorkingHrs`

---

## 🔒 Month Locking — How to Protect Records

### Lock Month Button
Located in [MonthlyHoursReport.tsx](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/components/attendance/MonthlyHoursReport.tsx#L730-L813)

**What `handleLockMonth()` saves:**

```
api.saveMonthSnapshots(snapshots)
    ├── employee_id, year, month
    ├── daily_data: [] → Full day-by-day status + times
    ├── summary: {} → All totals (presentDays, payableDays, OT, etc.)
    ├── rule_version_id → Links to which rule was used
    ├── locked_by, locked_by_name
    └── locked_at
```

After locking, **all future rule changes skip this month entirely.**

---

## ⚠️ What Is NOT Protected (Even When Locked)

| Data | Protected? | Reason |
|------|-----------|--------|
| Daily status (P/A/H/W/O) | ✅ Yes | Stored in snapshot `daily_data` |
| Payable days totals | ✅ Yes | Stored in snapshot `summary` |
| OT, leaves, shifts | ✅ Yes | Stored in snapshot `summary` |
| Leave BALANCES | ⚠️ Partially | Saved separately via `api.saveLeaveBalances()` at lock time |
| Scoped settings (site/entity) | ❌ No | No versioning for scoped settings — only global gets versioned |
| Billing records (site_invoice_tracker) | ❌ No | Independent table, not linked to snapshots |

---

## 🔴 Current Gaps / Risks

| Risk | Description | Severity |
|------|------------|----------|
| **Scoped rules not versioned** | Site/entity-level rules save directly with no versioning modal | 🔴 High |
| **No lock reminder** | Admin can save rules without being reminded to lock past months first | 🟡 Medium |
| **unlockMonth deletes snapshots** | Unlocking a month removes the frozen data permanently (hard delete) | 🟡 Medium |
| **Fallback to live rules** | If `attendance_rule_versions` has no match for a month, current live rules apply | 🟡 Medium |
| **Leave balances not versioned** | `attendance_month_snapshots` stores a point-in-time balance but leave_balances table is live | 🟡 Medium |

---

## ✅ Recommended Action Before Editing Rules

```
1. Go to: Monthly Hours Report → Select previous month
2. Review the report data carefully
3. Click "Lock Month & Freeze" (admin only)
   → This freezes all daily statuses + totals
4. THEN go to: HR → Attendance & Leave Rules
5. Click "Save Rules"
   → Set "Effective From" to the START of the new month
   → Add a change reason (e.g. "New FY policy")
6. Verify: The impact modal shows all past months as 🔒 Protected
```

---

## 📁 Key Files Reference

| File | Role |
|------|------|
| [AttendanceSettings.tsx](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/pages/hr/AttendanceSettings.tsx) | Rule editing UI + impact modal |
| [MonthlyHoursReport.tsx](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/components/attendance/MonthlyHoursReport.tsx) | Snapshot loading + Lock Month button |
| [api.ts (L949–1197)](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/services/api.ts#L949-L1197) | All versioning + snapshot API calls |
| [attendance.ts (L111–L230)](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/types/attendance.ts#L111-L230) | `StaffAttendanceRules` type definition |
| [20260603_attendance_rule_versioning.sql](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/supabase/migrations/20260603_attendance_rule_versioning.sql) | DB schema for versioning + snapshots |
