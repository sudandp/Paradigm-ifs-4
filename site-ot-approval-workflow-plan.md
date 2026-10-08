# Site OT Reporting & Dedicated Approval Workflow — Implementation Plan

> **Task Reference:** Fix erroneous OT notification on regular Site In, wire Site OT In/Out alerts to Reporting Manager, and build a dedicated OT Request approval workflow in the Notification Panel (mirroring Leave Requests).

---

## 1. Problem Statement & Root Cause Analysis

### 1.1 Issue 1: False Overtime Notification on Regular "Site In" (Image 1 & Image 2)
- **Current Behavior:** When field/site staff (e.g., Rajeshwari) punch in or perform a regular duty **Site In** (`workType: 'field'`, `action: 'site-in'`), the reporting manager receives an alert stating:
  > *"Rajeshwari has started an overtime (OT) punch cycle at Varthur - Sarj..."*
- **Root Cause:** In [`store/authStore.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/store/authStore.ts), the overtime cycle is calculated as:
  ```typescript
  const isOtCycle = currentDailyPunchCount >= 1 && newType === 'punch-in' && workType !== 'field';
  ```
  And around line 1538:
  ```typescript
  if (isOtCycle && newType === 'punch-in') {
      dispatchNotificationFromRules('ot_punch', { ... });
  }
  ```
  Whenever an employee does a main punch-in followed by a regular duty site check-in, or punches in when a previous session is tracked, this logic incorrectly marks the action as an OT cycle and fires `ot_punch` notifications to the manager.
- **Resolution:** Regular `punch-in` and `site-in` must **never** be treated as OT cycles. Overtime must strictly be triggered by explicit Site OT actions (`site-ot-in`, `site-ot-out`) or verified multi-shift duty extensions.

---

### 1.2 Issue 2: Site OT In & Out Reporting Alerts (Image 3)
- **Required Behavior:** As shown in Image 3 (e.g., Ganesha C performing `Site OT In 09:19 PM` and `Site OT Out 08:49 AM`):
  1. When an employee triggers **`site-ot-in`**: Immediately notify their direct reporting manager:
     > *"[Employee Name] has started an Overtime (OT) duty at [Site Name] at [Time]."*
  2. When an employee triggers **`site-ot-out`**: Immediately notify their direct reporting manager:
     > *"[Employee Name] has completed Overtime (OT) duty at [Site Name]. Total OT: [Hours Worked, e.g. 11h 30m] ([Start Time] to [End Time])."*

---

### 1.3 Issue 3: Dedicated OT Request Approval in Notification Panel (Image 4)
- **Required Behavior:** In Image 4, the slide-over notification panel displays **PENDING APPROVALS**:
  - `Leave Requests` (with pending count badge, employee details, and inline Approve / Reject buttons)
  - `Invoice Alerts`
  - `Security Violations`
- **Requirement:** Add a dedicated **OT Requests / Overtime Approvals** section under **PENDING APPROVALS**:
  1. Shows pending OT duty claims / completed OT sessions awaiting managerial sign-off.
  2. Displays employee photo, name, site location, duty date, start/end timestamps, and calculated OT duration.
  3. Provides instant **Approve** and **Reject** buttons right inside the panel (plus a link to view full details).
  4. **Access & Attendance Unlocking:**
     - Once approved by the reporting manager, the OT duty is officially credited toward the employee's attendance record and payroll (reflecting either 1.0 Duty + OT hours or 2.0x Double Duty pursuant to the *Paradigm Dynamic Shift Engine Rules*).
     - If rejected or pending, the duty remains uncredited or marked as pending approval.

---

## 2. Technical Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│                   Employee Mobile / PWA                │
│  • Clicks "Site Duty" -> Site OT In                    │
│  • Records GPS, Site, Timestamp                        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   authStore & API                      │
│  1. Inserts attendance_event (type: 'site-ot-in')      │
│  2. Dispatches Notification -> Reporting Manager       │
│     (Event: 'site_ot_start')                           │
└───────────────────────────┬────────────────────────────┘
                            │ (When OT Ends)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   authStore & API                      │
│  1. Inserts attendance_event (type: 'site-ot-out')     │
│  2. Creates / Updates OT Approval Record               │
│     (table: 'extra_work_logs' / 'ot_requests')         │
│     Status: 'Pending', Approver: user.reporting_mgr   │
│  3. Dispatches Notification -> Reporting Manager       │
│     (Event: 'site_ot_complete' + pending approval)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           Reporting Manager Notification Panel         │
│           (components/notifications/NotificationPanel) │
│  • PENDING APPROVALS -> "OT Requests" Badge            │
│  • Expand Accordion -> View Employee, Hours, Site      │
│  • Actions: [ Approve ] or [ Reject ]                  │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
       [Approve]                       [Reject]
              │                               │
              ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│ • Status: 'Approved'      │   │ • Status: 'Rejected'      │
│ • Attendance Engine       │   │ • Notification sent to emp│
│   credits OT / 2.0x Duty  │   │ • Duty uncredited         │
│ • Notification sent to emp│   └───────────────────────────┘
└───────────────────────────┘
```

---

## 3. Implementation Phases & Task Breakdown

### Phase 1: Fix Notification Dispatch Logic & Erroneous OT Triggers
- **File:** [`store/authStore.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/store/authStore.ts)
  - Remove/decouple the automatic `isOtCycle` inference that fires `ot_punch` on arbitrary `punch-in` events.
  - Ensure standard `site-in` always maps cleanly to `site_check_in` and triggers only regular duty notifications.
  - In `getActionTextForType`, ensure explicit and clean text for `site-ot-in` (*"started Site OT 🕒"*) and `site-ot-out` (*"completed Site OT ✅"*).

### Phase 2: Real-Time Reporting Manager Alerts for Site OT In & Out
- **Files:** [`store/authStore.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/store/authStore.ts), [`services/notificationService.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/services/notificationService.ts)
  - **On `site-ot-in`**:
    - Trigger `site_ot_start` event with actor metadata, location name, and formatted timestamp.
    - Directly alert the reporting manager (`data.actor.reportingManagerId`).
  - **On `site-ot-out`**:
    - Calculate the OT duration between the matching `site-ot-in` and this `site-ot-out`.
    - Trigger `site_ot_complete` event with duration details (e.g., *"completed Site OT at [Site Name] — Duration: 11h 30m"*).
    - Send push notification and internal system notification to the reporting manager.

### Phase 3: OT Request Generation & API Data Layer
- **Files:** [`services/api.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/services/api.ts), [`types/attendance.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/types/attendance.ts)
  - Verify and align `extra_work_logs` (or dedicated `ot_requests`) schema:
    - `id`, `user_id`, `work_date`, `claim_type: 'OT'`, `hours_worked`, `site_id`, `site_name`, `start_time`, `end_time`, `reason`, `status: 'Pending' | 'Approved' | 'Rejected'`.
  - When `site-ot-out` completes:
    - Auto-generate or upsert a pending OT claim record for the shift cycle, assigned to the user's reporting manager.
  - Add API methods:
    - `getPendingOtRequests(managerId?: string)`: Retrieves pending OT sessions for direct subordinates.
    - `approveOtRequest(requestId: string, approverId: string, notes?: string)`: Approves the OT duty, updates record to `'Approved'`, and notifies employee.
    - `rejectOtRequest(requestId: string, approverId: string, reason: string)`: Marks as `'Rejected'`, stores reason, and notifies employee.

### Phase 4: UI Integration in NotificationPanel (Matching Image 4)
- **File:** [`components/notifications/NotificationPanel.tsx`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/components/notifications/NotificationPanel.tsx)
  - In `fetchPendingApprovals()`:
    - Fetch pending OT requests via `api.getExtraWorkLogs({ claimType: 'OT', status: 'Pending', managerId: user.id })` (or `getPendingOtRequests`).
  - In `pendingCount` calculation:
    - Include pending OT requests count in total badge tally.
  - In JSX under `{/* PENDING APPROVALS */}`:
    - Render a dedicated **OT Requests** accordion section (mirroring Leave Requests):
      - Icon: `Clock` with indigo/amber styling.
      - Title: `OT Requests`, Subtitle: `Approvals needed`, Badge count.
      - Card details:
        - Employee avatar & name
        - Site badge / location
        - Date & time range (`09:19 PM → 08:49 AM`)
        - Total hours badge (e.g. `11h 30m`)
        - Reason / Shift notes
      - Action buttons:
        - **Approve** button (Green `CheckCircle`)
        - **Reject** button (Red `XCircle` with prompt/input for rejection reason)

### Phase 5: Attendance Credit & Policy Engine Synchronization
- **Files:** [`utils/attendanceCalculations.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/utils/attendanceCalculations.ts), [`utils/monthlyReportCalculations.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/utils/monthlyReportCalculations.ts)
  - Ensure the Dynamic Shift Engine checks OT approval status:
    - An OT duty only counts toward payable overtime or double duty multiplier (`A+B`, `B+C`, `A+C`) if `status === 'Approved'` (or if configured with auto-trust threshold).
    - If status is `Pending`, display an orange/amber badge (`Pending Approval`) on the attendance log and employee calendar.
    - If status is `Approved`, display a verified green badge (`OT Approved`), and unlock the credit for payable hours.

---

## 4. Verification & Testing Strategy

1. **Unit & Logic Validation:**
   - Test `site-in` event: Verify only regular duty notification is generated; ensure zero `ot_punch` notifications are fired.
   - Test `site-ot-in`: Verify reporting manager receives instant alert with correct employee, site, and start time.
   - Test `site-ot-out`: Verify reporting manager receives completion alert with calculated hours.
2. **UI & Interaction Validation:**
   - Log in as Reporting Manager.
   - Open Notification Panel (Image 4): Verify the **OT Requests** section appears with accurate count.
   - Expand and verify card typography, timestamps, duration, and site details.
   - Click **Approve**: Confirm request clears from list, badge updates, and approval notification is delivered to the employee.
   - Click **Reject**: Confirm reason prompt, status update to `Rejected`, and rejection alert sent to the employee.
3. **Attendance Log Verification:**
   - Check `LeaveDashboard` / `EmployeeLog` (Images 1 & 3): Ensure approved OT duty displays correctly as approved payable duty.
