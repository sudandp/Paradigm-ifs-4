# Project Plan: Capacitor Mobile Parity & Play Store Release

**Project:** Paradigm IFS (`com.paradigm.ifs`)  
**Type:** MOBILE (Capacitor Hybrid Shell + Web Parity)  
**Target:** 100% Zero-Drift Parity on Android & iOS + Play Store Submission  

---

## 1. Overview
Convert the existing Paradigm Office web application to a fully native shell using Capacitor with zero behavioral drift. Every module operating on web must function identically on mobile (Android first, then iOS). Only after end-to-end QA parity verification will the application be packaged, signed, and published to the Google Play Store.

---

## 2. Success Criteria
- [ ] Clean production build with relative API fallback for native shell.
- [ ] 100% native file download & sharing parity for Excel/PDF exports via `@capacitor/filesystem` & `@capacitor/share`.
- [ ] Safe clipboard copy utility wrapping `@capacitor/clipboard`.
- [ ] Native external link & WhatsApp redirection handling via `@capacitor/browser` / Android Intents.
- [ ] Android Studio build compiles clean (`./gradlew assembleRelease bundleRelease`).
- [ ] Full QA Parity Pass passes all 10 modules without white screens, missing downloads, or navigation lockouts.
- [ ] Google Play Console submission readiness (Data safety, declaration forms, privacy policy, store assets).

---

## 3. Tech Stack & Native Architecture
- **Web App Core:** React 19.0.0, Vite 7.2.4, TypeScript 5.9.3, Tailwind CSS v4.
- **Routing:** React Router DOM v7 (`<HashRouter>` active in `index.tsx`).
- **Hybrid Native Bridge:** Capacitor 7.6.0 (`@capacitor/core`, `@capacitor/android`, `@capacitor/ios`).
- **State & Storage:** Zustand 4.5.2, `@capacitor/preferences` (Android SharedPreferences), `idb` (IndexedDB offline sync).
- **Native Plugins:** Camera, Geolocation, Push Notifications, Local Notifications, Network, Device, Status Bar, Keyboard, App, Browser, Filesystem, Clipboard, Share, Social Login.

---

## 4. Phase Breakdown & Tasks

### Phase 0: Discovery & Inspection (COMPLETED)
- [x] **Framework & Bundler:** React 19 + Vite 7 detected.
- [x] **Rendering Mode:** Client-side SPA, zero SSR conflicts.
- [x] **Routing:** `<HashRouter>` verified in `index.tsx`.
- [x] **Storage:** `HybridAuthStorage` verified in `services/supabase.ts`.
- [x] **Hardware Back Button:** Verified in `App.tsx` & `useAppInitialization.ts`.
- [x] **Gaps Identified:** Relative `/api/*` endpoints, `saveAs(blob)` silent failure in WebView, `window.print()` in WebView, `window.open()` WhatsApp links, background location declaration for Play Store.

### Phase 1: Pre-Conversion Parity Fixes
- [x] **Task 1.1: File Download Adapter (`utils/fileDownloader.ts`)**
  - *Agent:* `mobile-developer` | *Skills:* `clean-code`, `mobile-design`
  - *Status:* Completed. Integrated in `excelExport.ts` and `excelTemplateEngine.ts`.
- [x] **Task 1.2: API Base URL Resolver (`utils/apiClient.ts`)**
  - *Agent:* `mobile-developer` | *Skills:* `clean-code`, `api-patterns`
  - *Status:* Completed. Integrated in `services/api.ts` for relative endpoints.
- [x] **Task 1.3: Unified Clipboard Helper (`utils/clipboardHelper.ts`)**
  - *Agent:* `mobile-developer` | *Skills:* `clean-code`
  - *Status:* Completed. Installed `@capacitor/clipboard@^7.0.0` and provided universal wrapper.
- [x] **Task 1.4: Android WebView Download & Intent Listener (`MainActivity.java`)**
  - *Agent:* `mobile-developer` | *Skills:* `mobile-design`
  - *Status:* Completed. Attached `DownloadListener` to `bridge.getWebView()`.

### Phase 2: Capacitor Sync & Native Parity Verification
- [x] **Task 2.1: Run Sync Pipeline**
  - *Status:* Completed via `npm run build` and `npx cap sync android`.
- [ ] **Task 2.2: Icon & Splash Screen Asset Check**
  - *Verify:* App icons in `res/mipmap-*/` and splash screen theme `#041b0f` display seamlessly on cold launch.

### Phase 3: Android Studio Build & Release Signing
- [x] **Task 3.1: Debug Build Compile Verification**
  - *Status:* Completed via `.\gradlew.bat assembleDebug` (`BUILD SUCCESSFUL in 1m 31s`).
- [ ] **Task 3.2: Release Signing & Proguard Hardening**
  - *Verify:* Keystore configuration in `build.gradle` and Proguard rules preserved in `proguard-rules.pro`.
  - *Command:* `cd android && ./gradlew bundleRelease`
  - *Verify:* AAB generated in `android/app/build/outputs/bundle/release/app-release.aab`.

### Phase 4: Full QA Parity Pass (Side-by-Side: Web vs. Android)
- [ ] 1. Auth & Session (Email + Google OAuth + Session Persistence).
- [ ] 2. Attendance & Selfie Geo-Punch (Camera stream + GPS accuracy).
- [ ] 3. Offline Attendance Engine (idb queuing + network reconnection sync).
- [ ] 4. Admin, HR, Client Dashboards.
- [ ] 5. Excel & PDF Exports (File Downloader adapter).
- [ ] 6. Hardware Back Button & Checked-In Exit Warning Modal.
- [ ] 7. Push Notifications & Break Alarm foreground/background pings.
- [ ] 8. Keyboard Avoidance & Safe-Area Inset styling.
- [ ] 9. Face Recognition WebGL Performance (no OOM).
- [ ] 10. External Redirections (WhatsApp, Maps, Play Store).

### Phase 5: Google Play Store Submission
- [ ] 1. Prepare Store Listing (Title, 80-char short desc, 4000-char full desc, privacy policy).
- [ ] 2. Upload Graphics: 512x512 High-Res Icon, 1024x500 Feature Graphic, 9:16 Phone Screenshots.
- [ ] 3. Complete Data Safety Form.
- [ ] 4. Background Location Declaration & Video Walkthrough.
- [ ] 5. Exact Alarm Policy Declaration.
- [ ] 6. Upload AAB to Internal Testing Track → Clear Pre-Launch Report.

### Phase 6: iOS Parity (Preparation)
- [ ] 1. Sync web assets: `npx cap sync ios`.
- [ ] 2. Validate Xcode workspace in `ios/ParadigmIFS/`.
- [ ] 3. Run side-by-side parity validation on iOS device/simulator.

---

## Phase X: Final Verification
- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run lint` passes.
- [ ] `npm run build` generates clean bundle.
- [ ] `cd android && ./gradlew assembleDebug` builds without errors.
- [ ] All 10 QA Parity Checklist items verified on device.
