# Offline-First Attendance System — Implementation Plan

## Goal
Make the entire attendance tracking system (punch in/out, breaks, site OT, field check-in/out, leave requests, attendance history, notifications) work **fully offline** across **Android (Capacitor), iOS (Capacitor), and Web (PWA)**. Client timestamps are authoritative. Offline data syncs automatically when connectivity resumes.

---

## Current State Assessment

### ✅ What Already Exists
| Component | File(s) | Status |
|-----------|---------|--------|
| Capacitor Android shell | `android/` + `capacitor.config.ts` | Working, v7.6 |
| Capacitor iOS shell | `ios/` | Scaffold exists |
| Offline DB (IDB + SQLite) | `services/offline/database.ts` | ✅ Outbox + Cache |
| Sync Service | `services/offline/syncService.ts` | ✅ Auto-sync, retry |
| Network detection | `hooks/useNetworkStatus.ts` | ✅ Capacitor Network |
| Offline banner UI | `components/OfflineStatusBanner.tsx` | ✅ Shows banner |
| Zustand persisted state | `store/authStore.ts` | ✅ localStorage |
| Secure storage | `utils/secureStorage.ts` | ✅ AES-256 encrypted |
| PWA manifest | `public/manifest.json` | ✅ Exists |
| VitePWA plugin | `vite.config.ts` | ❌ Commented out |

### ❌ Critical Gaps

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | Attendance punch is 100% online | Punch fails offline | 🔴 P0 |
| 2 | No offline auth | App unusable offline | 🔴 P0 |
| 3 | No cached user profile | No user data offline | 🔴 P0 |
| 4 | Face descriptors not cached | Face auth fails offline | 🔴 P0 |
| 5 | Geofencing settings not cached | Validation fails | 🟡 P1 |
| 6 | No service worker file | Web has no offline cache | 🟡 P1 |
| 7 | VitePWA disabled | No precaching for web | 🟡 P1 |
| 8 | No offline attendance history | Can't view past punches | 🟡 P1 |
| 9 | No offline leave requests | Leave requests fail | 🟡 P1 |
| 10 | Notifications queue offline | Notifications lost | 🟢 P2 |
| 11 | Location names need online | Names blank offline | 🟢 P2 |
| 12 | iOS not configured | iOS build won't work | 🟡 P1 |
| 13 | Sync outbox missing attendance | Offline punches never sync | 🔴 P0 |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                UI Layer                      │
│  AttendanceActionPage / Dashboard / History  │
├─────────────────────────────────────────────┤
│         Offline-First API Layer              │
│  offlineAttendanceService.ts (NEW)           │
│  ┌─────────┐  ┌───────────────────────────┐ │
│  │ Online? │─▶│ api.addAttendanceEvent()  │ │
│  │         │  │ + cache locally            │ │
│  │         │  └───────────────────────────┘ │
│  │         │  ┌───────────────────────────┐ │
│  │ Offline │─▶│ offlineDb.addToOutbox()   │ │
│  │         │  │ + update local state       │ │
│  │         │  └───────────────────────────┘ │
│  └─────────┘                                 │
├─────────────────────────────────────────────┤
│             Sync Engine                      │
│  syncService.ts (ENHANCED)                   │
│  - Network listener auto-triggers sync       │
│  - Outbox → Supabase (client timestamps)     │
│  - Pull latest → update local cache          │
├─────────────────────────────────────────────┤
│             Storage Layer                    │
│  IndexedDB (Web) │ SQLite (Mobile) │ Prefs   │
└─────────────────────────────────────────────┘
```

---

## Phase 1: Offline Auth & Session Persistence 🔴 P0

- [x] **1.1** Cache user profile to offline DB on login success
  - In `authStore.loginWithEmail`, call `offlineDb.setCache('current_user', appUser)`
  - Also cache `attendance_settings`, `geofencing_settings`, `user_locations`
  - Files: `store/authStore.ts`, `services/offline/database.ts`
  - Verify: Kill network after login → reload → user loads from cache

- [x] **1.2** Offline session restoration on app init
  - In `useAppInitialization.ts`, if Supabase session fails (offline), load from `offlineDb.getCache('current_user')`
  - Check `last_online_timestamp` — allow offline if within 14 days
  - Files: `hooks/useAppInitialization.ts`, `store/authStore.ts`
  - Verify: Login → offline → close & reopen → still logged in

- [x] **1.3** Track `last_online_timestamp`
  - Update in offline DB every successful Supabase communication
  - Files: `services/offline/syncService.ts`
  - Verify: Cache has `last_online_timestamp` after any API call

---

## Phase 2: Offline Attendance Punching 🔴 P0

- [x] **2.1** Create `services/offline/offlineAttendanceService.ts`
  - `punchAction(type, payload)` — queues to outbox if offline, calls API if online
  - `getLocalAttendanceState()` — reads cache + pending outbox
  - `mergeOnlineAndOfflineEvents()` — combines for display
  - Verify: Function exists with network branching

- [x] **2.2** Modify `toggleCheckInStatus()` to use offline service
  - Replace `api.addAttendanceEvent()` (line ~813) with offline service
  - If offline: queue to outbox + update Zustand immediately
  - Files: `store/authStore.ts`
  - Verify: Offline → punch in → toast success → state updated

- [x] **2.3** Cache today's events after `checkAttendanceStatus()`
  - Write events to `offlineDb.setCache('today_events_<userId>', events)`
  - Files: `store/authStore.ts`
  - Verify: Online punch → offline → reload → status correct

- [x] **2.4** Offline-aware `checkAttendanceStatus()`
  - Try API first, fall back to local cache + outbox merge
  - Files: `store/authStore.ts`
  - Verify: Offline → returns correct state from cache

- [x] **2.5** Offline location handling
  - Store raw lat/lng with `locationName: 'Offline Punch'` when geocode fails
  - Cache user locations list for offline geofence matching
  - Files: `store/authStore.ts`
  - Verify: Offline punch has GPS coords + "Offline Punch" name

---

## Phase 3: Offline Face Auth 🔴 P0

- [x] **3.1** Cache face descriptor on registration/login
  - Save Float32Array to `offlineDb.setCache('face_descriptor_<userId>', descriptor)`
  - Encrypt via secureStorage
  - Files: `utils/faceUtils.ts`, `services/gateApi.ts`
  - Verify: Register face → descriptor in offline DB

- [x] **3.2** Offline face matching in `PersonalFaceAuth.tsx`
  - If online: fetch from Supabase. If offline: load from cache
  - Same comparison threshold
  - Files: `components/attendance/PersonalFaceAuth.tsx`
  - Verify: Offline → face auth → matches cached descriptor

- [x] **3.3** Ensure face-api models available offline
  - Models in `public/models/` bundled in dist via Capacitor webDir
  - Verify: Airplane mode on Android → face detection works

---

## Phase 4: Offline Data Caching 🟡 P1

- [x] **4.1** Cache attendance history (current month)
  - On dashboard load, write to `offlineDb.setCache('history_<userId>_<YYYY-MM>', events)`
  - Show "Cached data" indicator when offline
  - Files: `pages/attendance/AttendanceDashboard.tsx`

- [x] **4.2** Offline leave requests
  - Queue to outbox when offline, show "Pending sync" badge
  - Sync handler already in syncService (line ~123)
  - Files: leave request pages

- [x] **4.3** Cache attendance settings & geofencing config
  - Write to offline DB after `fetchGeofencingSettings()`
  - Files: `store/authStore.ts`, `store/settingsStore.ts`

- [x] **4.4** Cache user locations for offline geofencing
  - Cache `getUserLocations()` and `getLocations()` results
  - Files: `store/authStore.ts`

---

## Phase 5: Web PWA Service Worker 🟡 P1

- [x] **5.1** Re-enable VitePWA in `vite.config.ts`
  - Uncomment + configure Workbox precaching
  - NetworkFirst for API, CacheFirst for static assets
  - Files: `vite.config.ts`

- [x] **5.2** Configure Workbox runtime caching rules
  - Supabase API → NetworkFirst (5s timeout)
  - Static assets → CacheFirst
  - Face models → CacheFirst

- [x] **5.3** Remove old `serviceWorkerRegistration.ts`
  - VitePWA handles registration automatically
  - Files: Delete `src/utils/serviceWorkerRegistration.ts`

- [x] **5.4** Update `manifest.json` for installability
  - Proper icons, theme_color, display: standalone
  - Verify: Lighthouse PWA ≥ 90

---

## Phase 6: Enhanced Sync Engine 🟡 P1

- [x] **6.1** Attendance sync with `is_offline_sync` flag
  - Client timestamp authoritative, handle 409 duplicates
  - Files: `services/offline/syncService.ts`

- [x] **6.2** Notification queueing
  - Queue `dispatchNotificationFromRules()` to outbox when offline
  - Replay on sync
  - Files: `services/notificationService.ts`

- [x] **6.3** Create `SyncStatusIndicator.tsx`
  - Pending count, last sync time, sync spinner
  - Files: NEW component

- [x] **6.4** Manual "Sync Now" button
  - In settings/profile, force immediate sync
  - Files: profile/settings pages

---

## Phase 7: Android Native Build 🟡 P1

- [ ] **7.1** Verify SQLite plugin on Android device
- [ ] **7.2** Build APK with offline assets (`npm run build:apk`)
- [ ] **7.3** Verify Android permissions in manifest
- [ ] **7.4** Test background sync on Android

---

## Phase 8: iOS Build & Configuration 🟡 P1

- [ ] **8.1** `npx cap add ios` + `npx cap sync ios` → verify Xcode build
- [ ] **8.2** iOS permissions in Info.plist
- [ ] **8.3** iOS SQLite verification
- [ ] **8.4** iOS keyboard/UI/safe-area adjustments

---

## Phase 9: Offline UI/UX Polish 🟢 P2

- [x] **9.1** Enhanced offline banner with sync count + animations
- [x] **9.2** Offline indicators on action pages ("📴 Offline mode" chip)
- [x] **9.3** Attendance history "Cached" badge with timestamp
- [x] **9.4** Outbox viewer for admin/debug

---

## Phase 10: Verification & Testing 🟢 P2

- [ ] **10.1** Android E2E: login → offline → punch/break/OT → online → verify sync
- [ ] **10.2** Web PWA: Chrome offline → punch → online → Lighthouse ≥ 90
- [ ] **10.3** iOS E2E: same flow as Android
- [ ] **10.4** Edge cases: multi-day offline, 7-day limit, duplicate prevention, low storage, app kill mid-sync, clock manipulation detection

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Offline auth duration | **14 days** (configurable) | Security vs usability for field workers |
| Conflict resolution | Client wins | Remote areas can't wait for server |
| Face descriptor storage | Encrypted SQLite/IDB | Needed offline; AES-256 |
| Offline queue max | **1000 items** (warn at 800) | Prevent overflow on low-end devices |
| Sync strategy | Push-then-Pull | Send outbox first, then refresh |
| Timestamp authority | Client device time | Server records `synced_at` for audit |
| PWA caching | Workbox (VitePWA) | Already a dependency |
| Cache auto-purge | **3 months** | Old attendance history auto-deleted |

## Done When
- [x] User can login once, use app offline for 14 days
- [x] All attendance actions work offline
- [x] Face auth works offline with cached descriptors
- [x] Leave requests queue offline and sync online
- [x] History viewable from cache offline
- [x] Notifications queue and dispatch on reconnection
- [x] Web PWA Lighthouse ≥ 90
- [ ] Android APK tested on real device
- [ ] iOS build compiles and works on simulator
- [x] Sync indicator shows pending/synced status
