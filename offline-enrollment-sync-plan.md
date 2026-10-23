# Offline-First Enrollment & Cloud Sync Plan

## 1. Problem Statement & Root Cause Analysis

### What Happens Today
- **On Laptop**: User is on stable high-speed Wi-Fi/LAN. `saveOfflineAware` attempts `onlineSave` immediately; image uploads and database upsert complete synchronously. The record appears in Supabase and syncs across all connected devices in real time.
- **On Phone (Mobile Web / PWA)**:
  1. **Non-blocking Notification / Auth Failures Crash Submission**: In `services/api.ts` (`submitOnboarding`), right after saving the submission, the code executes:
     ```typescript
     const { data: { user } } = await supabase.auth.getUser();
     dispatchNotificationFromRules('onboarding_submitted', ...);
     ```
     When offline or on weak mobile connections, `supabase.auth.getUser()` and `dispatchNotificationFromRules` attempt network fetches to `notification_rules`. This throws an unhandled network error, causing `handleSubmit` in `AddEmployee.tsx` to catch `Failed to submit application.` and abort before the form is properly queued and navigated!
  2. **Attachment Extraction Missing Base64 Data URLs**:
     In `services/api.ts`, `extractAttachments` only extracts objects if:
     ```typescript
     if (obj.file instanceof File || obj.file instanceof Blob || obj.blob instanceof Blob)
     ```
     On mobile browsers, when capturing via camera or when drafts rehydrate from storage, `obj.file` is stripped or nullified, and documents exist as base64 data URLs in `obj.preview`. Because they are not instances of `File`, `extractAttachments` skips them. The giant multi-megabyte base64 strings stay embedded in the JSON payload! When sent to Supabase or queued in IndexedDB, they either exceed Postgres payload limits or get rejected.
  3. **Heavy Uncompressed Camera Photos**:
     Mobile cameras capture 5MB–12MB images per side (Aadhaar Front, Aadhaar Back, PAN, Bank Proof, Profile Photo). Storing 30MB+ of raw blobs in IndexedDB quickly overwhelms mobile memory and causes mobile browser tab crashes or timeout during upload.
  4. **Online Status False Positives & Short Reachability Timeouts**:
     Mobile browsers often report `navigator.onLine === true` even on captive portals, weak 2G/3G cells, or zero-data connections. The 3-second reachability timeout (`isReachable(3000)`) frequently aborts valid background drains on mobile networks.
  5. **Visibility & Background Drain Throttling**:
     Mobile Safari and Chrome aggressively throttle or freeze background timers (`setInterval`) as soon as the screen turns off or the tab is switched. Without reconnect listeners on window focus and network resume, the queue remains in `outbox` until manually triggered.

---

## 2. Target Architecture: 5-Stage Resilient Pipeline

```
┌────────────────────────────────────────────────────────┐
│               Mobile Phone (PWA / Browser)              │
│                                                        │
│  [Camera / File Input] ──► Client Compression (<300KB)  │
│                                      │                 │
│                                      ▼                 │
│  [Form Submit] ──► Unified Outbox Enqueue (IndexedDB)  │
│                                      │                 │
│                 ┌────────────────────┴────────────────┐│
│                 ▼                                     ▼│
│         [Online & Fast]                     [Offline / Weak]   │
│       Immediate Cloud Sync           Queued in IDB Outbox Badge │
└─────────────────┬─────────────────────────────────────┬┘
                  │                                     │
                  │              Auto Reconnect Event   │
                  │           (window focus + online)   │
                  │                                     ▼
                  │                        Sync Engine Drain
                  │                                     │
                  ▼                                     ▼
┌────────────────────────────────────────────────────────┐
│                   Supabase Cloud Backend                │
│   • Storage: onboarding-documents bucket               │
│   • Database: onboarding_submissions row               │
│   • Realtime Broadcast: submissions-feed               │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│              Connected Device (Laptop / Admin)         │
│   • Realtime channel receives postgres_changes         │
│   • New employee pops up with "Synced" badge           │
└────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Implementation Tasks

### Phase 1: Robust Offline Attachment Extraction & Compression
- **File**: `services/api.ts` (`extractAttachments`)
  - Enhance `extractAttachments` to detect:
    - `obj.file instanceof File || obj.file instanceof Blob`
    - `obj.preview && typeof obj.preview === 'string' && obj.preview.startsWith('data:')`
    - Convert base64 data URLs to binary Blobs on-the-fly and register them as attachments in the outbox `photos` store.
    - Replace the heavy base64 string in the payload with a lightweight metadata placeholder (`{ name, type, size, pending: true }`).
- **File**: `components/UploadDocument.tsx`
  - Ensure all mobile camera and file inputs pass through `compressImageFile(file, CLIENT_COMPRESSION_PRESETS.DOCUMENT)` (< 300KB, max 1600px dimension) before setting into store or outbox.

### Phase 2: Decouple Non-Critical Online Actions from Submission
- **File**: `services/api.ts` (`submitOnboarding`, `updateOnboarding`)
  - Wrap `dispatchNotificationFromRules('onboarding_submitted', ...)` and `supabase.auth.getUser()` in a non-blocking `try/catch` or queue notifications to offline outbox if offline.
  - Ensure `submitOnboarding` returns the locally cached submission if `api.getOnboardingDataById` cannot query the cloud.
- **File**: `pages/onboarding/AddEmployee.tsx`
  - When `api.submitOnboarding` succeeds (whether synced immediately or queued offline):
    - Show an affirmative toast: `"Enrollment saved! Queued to sync automatically when online."`
    - Reset the form state and navigate cleanly to `/onboarding` or `/site/dashboard`.

### Phase 3: Mobile Network & Auto-Sync Engine Resilience
- **File**: `services/offline/syncEngine.ts`
  - Increase mobile reachability timeout from `3000ms` to `6000ms` to avoid aborting valid mobile connections.
  - Add `visibilitychange` and `focus` event listeners to trigger `syncEngine.drain()` whenever the user brings the mobile PWA back to the foreground.
  - Add progressive retry with exponential backoff for failed attachment uploads.
- **File**: `services/offline/saveOfflineAware.ts`
  - Treat timeout errors and offline network drops identically: stage cleanly to `outbox` and return `'queued'` rather than bubbling errors to the UI.

### Phase 4: UI Sync Indicators & Cross-Device Verification
- **File**: `pages/verification/VerificationDashboard.tsx` & `pages/onboarding/SubmissionsPage.tsx`
  - Ensure pending outbox items are merged into the displayed submission list on the mobile phone with a distinct `Not Synced (Offline)` badge so the user has 100% confidence their work is saved locally.
  - When network connects, background drain executes, updates the item to `Synced`, and triggers Supabase Realtime to push the record to the laptop dashboard.

---

## 4. Verification & Testing Protocol

| Scenario | Test Steps | Expected Result |
| :--- | :--- | :--- |
| **1. Offline Submission on Mobile** | 1. Enable Airplane mode on phone.<br>2. Fill new enrollment with photos.<br>3. Tap Submit. | Form saves to IndexedDB immediately, shows offline success confirmation, returns to dashboard with "Pending Sync (1)" pill. |
| **2. Auto Reconnect Sync** | 1. Turn Airplane mode OFF.<br>2. Re-open phone browser / bring tab to foreground. | Sync Engine detects connection, uploads photos to Supabase Storage, upserts row to `onboarding_submissions`. Badge changes to "Synced". |
| **3. Cross-Device Verification** | 1. Keep Verification Dashboard open on laptop.<br>2. Complete Step 2 on phone. | Realtime listener on laptop fires automatically without manual page refresh. New employee appears on laptop dashboard. |
| **4. Flaky Network Resilience** | 1. Throttle mobile connection to "Slow 3G".<br>2. Submit application. | Online timeout gracefully falls back to Outbox without error toasts, photos compressed <300KB upload reliably. |
