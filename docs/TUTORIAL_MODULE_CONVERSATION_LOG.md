# Paradigm Hands-On Training Lab: Development Log & System Architecture

> **Document Type:** Project Conversation & Engineering Knowledge Base  
> **Target Module:** Interactive Training Simulator (`InteractiveTutorialSimulator.tsx`)  
> **Application:** Paradigm IFS v4 (Android & Web)  
> **Last Verified Date:** October 4, 2026  
> **Target Device Verified:** Samsung Galaxy SM-M075F (`R9ZL20MN6SD`)  

---

## 1. Executive Summary & Purpose

The **Paradigm Hands-On Training Lab** is a zero-risk, sandbox simulator embedded directly into the Paradigm mobile and web applications. It allows site workers, facility technicians, security staff, and housekeeping staff to practice core attendance operations in a safe, interactive environment before performing real-world actions.

### Core Architectural Axiom: 100% In-Memory Simulation
- **No Database Writes:** The simulator strictly isolates all state inside React component memory. No entries are inserted into Supabase (`attendance_records`, `attendance_corrections`, `device_logs`) or MSSQL (`dbo.DeviceLogs`, `dbo.AttendanceLogs`).
- **Complete Realism:** Sound chimes (Web Audio API), camera face-scan animations, biometric verification rings, geolocation geofence badges, duty credit updates, and managerial approval mock lifecycles behave identically to production.

---

## 2. Chronological Record of User Requests & Evolutions

1. **Red Boxed Layout / UI Polish:**
   - Fixed layout clipping, overflow issues, and unaligned container boxes across mobile viewports.
2. **Punch Sequence Correction:**
   - Fixed an issue where the user started from the beginning, pressed Punch IN, yet Punch OUT was immediately visible or prematurely accessible.
   - Redesigned step-by-step state gating so Punch OUT is unlocked only after a valid simulated Punch IN.
3. **Site Duty vs. Regular Duty Rules Integration:**
   - Differentiated standard Back-Office shifts (Regular Duty) from Site Shortage/Replacement/Reliever duties (Site Duty).
   - Enforced operational rules: An employee cannot do both simultaneously. If a user misses punch-in or punch-out, they do not receive duty credit for that day without regularization.
   - Designed a comprehensive rules training module into the flow.
4. **Request Punch (Attendance Correction) & Workflow Integration:**
   - Added Step 7 simulator for Missed Punch regularization.
   - Outlined educational pathways for: viewing muster roll attendance, leave & comp-off eligibility, permission requests, and help ticket submission.
5. **Full Android Build, Deploy & Live Device Verification:**
   - Automated Vite compilation (`npm run build`), Capacitor Android sync (`npx cap copy android`), Gradle assemble (`assembleDebug`), and ADB direct install to connected physical device.
   - Confirmed Step 7 live on device with manager approval animation.
6. **Documentation & Knowledge Preservation:**
   - Archiving the entire development context, rules, and code patterns into this standardized Markdown reference.

---

## 3. Paradigm Shift & Attendance Rules Matrix

These rules represent the single source of truth defined in the Paradigm shift engine (`.agent/rules/shift-engine-rules.md`):

### 3.1 Operational Shift Windows
| Shift Code | Shift Name | Arrival / IN Window | Typical Shift Span | Anchored Date | Multiplier | Target Roles |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A** | Morning Shift | 05:00 – 11:30 | 07:00 to 15:00 (or 06:30/08:00) | Current Day | 1.0x | Site Staff (MEP / Technical) |
| **B** | Afternoon / Evening Shift | 11:30 – 18:30 | 14:00 to 22:00 (or 13:30/15:00) | Current Day | 1.0x | Site Staff (MEP / Technical) |
| **C** | Night Shift | 18:30 – 23:59 (or < 05:00) | 21:00/22:00 to 06:00/07:00 next day | **Day 1 (IN Date)** | 1.0x | Site Staff (MEP / Technical) |
| **GS** | General Corporate Shift | 07:30 – 11:30 | 09:00 to 18:00 (≥ 8h with departure ≥ 16:00) | Current Day | 1.0x | All Roles |
| **HK-M** | Housekeeping Morning | 06:30 – 07:30 | 07:00 to 16:00 (≥ 8h) | Current Day | 1.0x | Housekeeping Staff |
| **GAR** | Garden Shift Group | 07:45 – 09:00 | 08:00 to 17:00 (≥ 8h) | Current Day | 1.0x | Landscaping / Garden |
| **DAY-12** | Security Day Duty (12h) | 05:30 – 09:30 | 07:00 to 19:00 (≥ 11h) | Current Day | 1.0x / Rate | Security Staff |
| **NIGHT-12**| Security Night Duty (12h)| 17:30 – 21:30 | 19:00 to 07:00 next day (≥ 11h) | **Day 1 (IN Date)** | 1.0x / Rate | Security Staff |

### 3.2 Night Shift C Midnight Rule
- Punch IN between `18:30` and `23:59` on Day 1, and punch OUT before `10:00 AM` on Day 2:
  - The entire duty is credited to **Day 1 as Shift C**.
  - Day 2 morning punch-out (06:00 – 08:00 AM) is consumed as the OUT-punch of Day 1's Night Shift.
  - Day 2 morning punch-out is **NEVER** treated as Day 2 morning check-in.

### 3.3 Double Duty Combinations (2.0x Multiplier)
- **Shift A + B (Morning + Afternoon):** IN 06:00–08:30, OUT ≥ 22:00 (≥ 14h continuous span). Multiplier: 2.0x.
- **Shift B + C (Afternoon + Night):** IN 13:30–15:30, OUT ≥ 06:00 AM next day (≥ 14h span). Multiplier: 2.0x, anchored to Day 1.
- **Shift A + C (Morning + Night Split):** Morning Shift A + distinct night Shift C on same date. Multiplier: 2.0x, anchored to Day 1.
- **Overtime vs Double Duty:** 10 to 12 hours worked is **1.0 Duty + OT hours**, NOT Double Duty. Double Duty strictly requires ≥ 14 hours across two shift brackets.

### 3.4 Missed Punch Penalty & Correction Quotas
- If either the IN-punch or OUT-punch is missing:
  - System automatically flags status as **Half Duty / Absent (0.0 Duty Credit)**.
  - To restore credit, employee must submit an **Attendance Correction Request** before payroll cutoff (typically 24th of the month).
  - Monthly quota: Maximum **2 missed punch corrections per calendar month**. Excess requests require Operations Manager manual bypass.

### 3.5 Weekly Off & Holiday Entitlement
- **Automatic 6-Day Duty Cycle:** 1 earned paid Weekly Off (W/O) earned after 6 completed working duties.
- **Strict 1 W/O Cap:** Maximum 1 Weekly Off per calendar week (Monday to Sunday). Additional unworked days are marked Absent (A).
- **Weekly Off Worked (W/P):** Working on scheduled off gives 1.0x duty credit plus compensatory off entitlement.

---

## 4. 7-Step Interactive Simulator Architecture

The interactive training module is implemented in:  
[InteractiveTutorialSimulator.tsx](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/components/tutorial/InteractiveTutorialSimulator.tsx)

### 4.1 Step Pipeline & User Flow
```
[1. Welcome & Shift Selection]
             │
             ▼
[2. Site vs Regular Duty Rules]
             │
             ▼
[3. Geofence & Location Check]
             │
             ▼
[4. Face Recognition Scan (IN)]
             │
             ▼
[5. Active Shift Tracker & Double Duty Timer]
             │
             ▼
[6. Punch OUT & Shift Summary]
             │
             ▼
[7. Missed Punch Regularization Simulator] ──► [Manager Approval] ──► [Completion Certificate]
```

### 4.2 State Machine Breakdown
```typescript
export type SimStep =
  | 'welcome'
  | 'rules'
  | 'geofence'
  | 'punch_in'
  | 'shift_active'
  | 'punch_out'
  | 'correction'   // Step 7 Missed Punch Regularization
  | 'completed';
```

### 4.3 Step 7 State Extensions
```typescript
// Correction States
const [correctionReason, setCorrectionReason] = useState<CorrectionReason>('forgot_out');
const [correctionStatus, setCorrectionStatus] = useState<CorrectionStatus>('idle');

export type CorrectionReason = 'forgot_in' | 'forgot_out' | 'device_glitch';
export type CorrectionStatus = 'idle' | 'submitting' | 'submitted' | 'approved';
```

### 4.4 Multi-Language Voice Synthesis
Supports 5 Indian languages with native BCP-47 speech synthesis tags and phonetic fallback:
- **en-IN**: English (Indian Accent)
- **hi-IN**: Hindi (हिंदी)
- **ta-IN**: Tamil (தமிழ்)
- **te-IN**: Telugu (తెలుగు)
- **kn-IN**: Kannada (ಕನ್ನಡ)

Audio cues are generated using the Web Audio API with distinct frequencies:
- **Success Chime:** Two-tone C5 (523.25Hz) to G5 (783.99Hz)
- **Attention Chime:** 659.25Hz (E5) gentle bell
- **Warning Chime:** 329.63Hz (E4) low double pulse

---

## 5. Step 7: Request Punch & Regularization Simulator Implementation Details

### 5.1 Educational Objective
To teach the worker what happens when an OUT punch is missed, how absent/zero-credit days are generated, and how to self-resolve using the built-in Request Punch flow.

### 5.2 UI Components in Step 7 Card
1. **Amber Alert Warning Header:**  
   Displays *"Simulated Scenario: Yesterday's Shift OUT-Punch was Missed! Status: 0.0 Duty (Absent)"*.
2. **Monthly Quota Tracker Badge:**  
   Highlights *"Allowed: 2 / Month | Used: 0 / 2"* to educate workers on avoiding habitual punch skipping.
3. **Interactive Reason Selector:**  
   Pills for:
   - 🕒 *Forgot Punch-Out (Checked out on time)*
   - 🚪 *Forgot Punch-In (Started shift on time)*
   - ⚡ *Device / Network Sensor Glitch*
4. **4-Stage Submission & Approval Simulation:**
   - **Idle:** Displays editable time fields and `Submit Correction Request` button.
   - **Submitting:** 1.2-second pulse animation mimicking network encryption and Supabase sync.
   - **Submitted:** Displays green badge *"Submitted to Shift Incharge (Pending Review)"*.
   - **Approved:** Automated 2.5-second simulation triggering *"Manager Approved! 1.0 Duty Credit Restored"* with confetti-style celebration ring.

---

## 6. Build, Deployment & Device Verification Playbook

### 6.1 Standard Android Production Deployment
```powershell
# 1. Clean Vite Build
npm run build

# 2. Sync Web Assets to Capacitor Android Project
npx cap copy android

# 3. Compile Native Android APK
cd android
./gradlew assembleDebug
cd ..

# 4. Streamed ADB Install to Connected Device
adb -s R9ZL20MN6SD install -r android/app/build/outputs/apk/debug/app-debug.apk

# 5. Launch App on Target Device
adb -s R9ZL20MN6SD shell monkey -p com.paradigm.ifs -c android.intent.category.LAUNCHER 1
```

### 6.2 Target Hardware Profile
- **Device Model:** Samsung Galaxy SM-M075F
- **Device Serial:** `R9ZL20MN6SD`
- **Resolution:** 720 x 1600 px (Android 14 / One UI Core)
- **Environment:** Live Physical Deployment at Kithiganur site

---

## 7. Design System & Aesthetic Directives

- **Color Palette:**
  - Background Base: `#041B0F` (Deep Forest Obsidian)
  - Card Surface: `#06241a` with border `rgba(16, 185, 129, 0.25)`
  - Emerald Primary Accent: `#10B981` / `#059669`
  - Amber Warning Accent: `#F59E0B` / `#D97706`
  - Cyan Info Accent: `#06B6D4`
- **Purple Ban:** Absolute prohibition of violet, purple, indigo, or lavender shades.
- **Haptic Feedback:** Native vibration pulses (`navigator.vibrate(40)`) on button taps, step changes, and face scan completion.
- **Dynamic Responsiveness:** Touch targets minimum 48px height with responsive scroll containers to ensure zero clipping on small screens.

---

## 8. Roadmap: Pending Future Training Modules

The following training modules are planned for subsequent development phases using the same in-memory architectural pattern:

1. **Module 3: Muster Roll & Attendance History (`SimStep: 'muster'`)**
   - Teach workers how to interpret `P` (Present), `A` (Absent), `W/O` (Weekly Off), `H` (Holiday), and `W/P` (Weekly Off Worked).
   - Monthly summary counters (Payable Days, Overtime Hours, Deductions).
2. **Module 4: Leave & Comp-Off Eligibility (`SimStep: 'leaves'`)**
   - Earned Leave (EL) vs Casual Leave (CL) calculation rules.
   - How working on Weekly Off (`W/P`) generates a Compensatory Off credit valid for 60 days.
3. **Module 5: Permission & Shift Swap Requests (`SimStep: 'permission'`)**
   - 2-hour early exit or late arrival gate passes.
   - Peer shift-swapping workflow with supervisor sign-off.
4. **Module 6: Help Desk & Support Ticket Submission (`SimStep: 'helpticket'`)**
   - Reporting biometric scanner hardware issues, incorrect site geolocation, or uniform/PPE requisitions.

---

## 9. Key Files Reference

| File Path | Description |
| :--- | :--- |
| `components/tutorial/InteractiveTutorialSimulator.tsx` | Core 7-step interactive training simulator component |
| `components/dashboard/AttendanceActionCards.tsx` | Production Punch In / Out action card container |
| `services/attendanceService.ts` | Master attendance sync, biometric debouncing, and shift calculation |
| `.agent/rules/shift-engine-rules.md` | Authoritative Paradigm shift assignment and double duty engine rules |
| `docs/TUTORIAL_MODULE_CONVERSATION_LOG.md` | This document — Full engineering log & architecture guide |

---
*Created and maintained by the Paradigm Core Engineering Team.*
