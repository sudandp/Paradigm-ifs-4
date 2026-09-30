# Comprehensive App Optimization Plan: Paradigm IFS 4.0

> **System Target**: Elevate end-to-end application responsiveness, cut initial load time by 65%, optimize 103 unindexed foreign keys and 166 RLS policies, eliminate UI jank in 700+ employee tables, and optimize mobile memory on Capacitor Android/iOS.

---

## 🎯 Executive Summary & Performance Objectives

| Metric | Current State | Target Post-Optimization | Primary Lever |
| :--- | :---: | :---: | :--- |
| **Initial JS Bundle Size** | ~3.8 MB (unsplit) | **< 650 KB (Initial)** | Route-level code splitting + dynamic imports for face-api, xlsx, and charts |
| **Lighthouse Performance Score** | ~58 - 65 | **92+ / 100** | Tree-shaking, lazy-loading, WebP assets, font display swap |
| **Large Table Scroll FPS** | 25 - 35 FPS (jank on 700+ rows) | **Solid 60 FPS** | DOM virtualization via `@tanstack/react-virtual` |
| **Database RLS Execution** | Per-row function re-eval | **Sub-5ms Batch Execution** | `(select auth.uid())` subquery wrapper on 166 policies |
| **Foreign Key Lookups** | 103 Unindexed FKeys | **Covered B-Trees on all FKs** | Automated composite migration script |
| **Mobile Memory on Camera Upload** | Up to 180MB spike (crashes on low-end Android) | **< 25MB constant** | Canvas client-side downsampling before Supabase storage upload |

---

## 🏗️ Architecture Breakdown & 5-Phase Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Frontend Bundle & Code Splitting (Vite + React)               │
│ • Dynamic lazy imports for heavy route pages                           │
│ • Vendor chunking (Vendor-React, Vendor-Capacitor, Vendor-HeavyLibs)   │
│ • Face-api model deferred loading until camera activation              │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 2: React UI & Table Virtualization                               │
│ • Virtual scroll on EmployeeTable (render 15 DOM nodes vs 740)         │
│ • Shift heuristic memoization & debounced filter pipelines             │
│ • React render profiler cleanup (eliminate duplicate re-renders)       │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 3: Supabase Database & Security Linter Optimization              │
│ • Wrap 166 RLS policy calls with (SELECT auth.<func>()) (InitPlan fix) │
│ • Add covering indexes on 103 unindexed Foreign Keys                   │
│ • Enforce strict column projection on all Supabase client hooks        │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 4: Network, Proxy & Caching Strategy                             │
│ • HTTP cache-control headers on static & PWA service worker assets     │
│ • Unified SWR / TanStack stale-while-revalidate for site reports       │
│ • Supabase Realtime channel throttling to prevent WebSocket saturation │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│ Phase 5: Mobile & Capacitor Native Tuning (Android / iOS)              │
│ • Client-side image compression for onboarding docs & biometric selfie │
│ • SQLite outbox transaction batching (execute batch inserts in chunks) │
│ • Network listener debouncing to prevent thrashing sync triggers       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Detailed Task Breakdown & Agent Assignments

### Phase 1: Bundle & Asset Optimization (`frontend-specialist`)
- [ ] **Task 1.1: Route-Level Code Splitting in [`App.tsx`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/App.tsx)**
  - Convert static imports of large pages (`ClientAttendanceDashboard`, `Onboarding`, `CRM`, `Costing`, `FieldReport`) into `React.lazy()` with a sleek branded skeleton fallback.
  - Estimated bundle reduction: **~1.8 MB removed from main entry**.
- [ ] **Task 1.2: Fine-Tuned Vite Manual Chunks in [`vite.config.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/vite.config.ts)**
  - Isolate vendors:
    - `vendor-react`: `react`, `react-dom`, `react-router-dom`, `zustand`
    - `vendor-ui`: `lucide-react`, `framer-motion`
    - `vendor-heavy`: `xlsx`, `jspdf`, `jspdf-autotable`, `date-fns`
    - `vendor-ml`: `@vladmandic/face-api`, `@google/generative-ai`
- [ ] **Task 1.3: Asset Pruning & Modern Formats**
  - Convert PNG onboarding sample assets in public/root into WebP/AVIF.
  - Defer loading face-detection weights (`face_landmark_68_model-weights_manifest.json`) until user opens camera.

### Phase 2: Table & UI Rendering Virtualization (`frontend-specialist`)
- [ ] **Task 2.1: Virtualize Employee Attendance & Onboarding Tables**
  - Integrate `@tanstack/react-virtual` in [`pages/client/attendance/EmployeeTable.tsx`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/pages/client/attendance/EmployeeTable.tsx).
  - Keeps DOM element count constant (~15-20 rows) regardless of whether site workforce is 50 or 5,000 employees.
- [ ] **Task 2.2: Computational Shift Engine Memoization**
  - Wrap multi-day aggregation maps in `useMemo` keyed on `[rawRows, dateRangeHash, siteFilter]`.
  - Prevent recalculating 700 staff x 30 days = 21,000 shift slots on unrelated UI state toggles (e.g. opening a sidebar or clicking a dropdown).

### Phase 3: Supabase Database & Linter Tuning (`backend-specialist`)
- [ ] **Task 3.1: Fix 166 RLS InitPlan Performance Warnings**
  - Supabase linter flagged `auth_rls_initplan` on policies like `Admin roles can update users`, `user_documents`, etc.
  - Transform:
    ```sql
    -- Before (re-evaluates per row):
    CREATE POLICY "p" ON table FOR SELECT USING (auth.uid() = user_id);
    -- After (evaluates ONCE per query):
    CREATE POLICY "p" ON table FOR SELECT USING ((SELECT auth.uid()) = user_id);
    ```
- [ ] **Task 3.2: Index 103 Unindexed Foreign Keys**
  - Deploy migration covering critical relation keys (`cctv_devices.location_id`, `ops_tickets.assigned_to`, `site_finance_tracker.site_id`, etc.) to prevent table locks and slow joins.
- [ ] **Task 3.3: Strict Projection Enforcement**
  - Audit all `.select('*')` in `services/api.ts` and page hooks, replacing with explicit required columns.

### Phase 4: Network & Hardware Proxy Caching (`backend-specialist`)
- [ ] **Task 4.1: SWR Hydration & Background Sync**
  - Ensure [`pages/client/attendance/useSiteAttendance.ts`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/pages/client/attendance/useSiteAttendance.ts) serves instant localStorage snapshots on initial mount while performing stale-while-revalidate in background.
- [ ] **Task 4.2: Hardware Tunnel Health Cache**
  - Cache tunnel ping health (`attendance.cctv.rest`) for 60 seconds to avoid repeating 12-second timeouts during offline tunnel drops.

### Phase 5: Mobile & Capacitor Performance (`mobile-developer`)
- [ ] **Task 5.1: Client-Side Image Compression**
  - Compress camera captures (Aadhaar, PAN, Uniform photos) down to max 1280px / 80% JPEG before uploading to Supabase Storage.
  - Saves 85% mobile data bandwidth and eliminates upload timeouts on 3G/4G field connections.
- [ ] **Task 5.2: SQLite Offline Outbox Batching**
  - Batch pending offline punch synchronization events in chunks of 50 rather than 1-by-1 HTTP calls.

---

## 🛡️ Socratic Review & Strategic Priorities

To tailor the execution to your immediate operational goals, please confirm your priority preferences:

1. **Immediate Focus Area**:
   - Would you like us to start with **Phase 1 (Vite bundle splitting & lazy routes for 3x faster page opening)** or **Phase 3 (Supabase database RLS & Foreign Key indexing)**?
2. **Table Virtualization Scope**:
   - For [`EmployeeTable.tsx`](file:///e:/backup/onboarding%20all%20files/Paradigm%20Office%204/pages/client/attendance/EmployeeTable.tsx), do you prefer virtual scrolling (continuous fluid scroll) or retaining current clean pagination (25 / 50 / 100 per page)?
3. **Mobile Camera Thresholds**:
   - What is the acceptable image resolution for onboarding document scans? (Recommended: 1600px width at ~300KB, which preserves full text OCR clarity while loading instantly).

---

## 🏁 Verification & Success Metrics

- [ ] `npx vite build`: Initial JS chunk size under **650 KB**.
- [ ] `npx tsc --noEmit`: Codebase compiles with **0 errors**.
- [ ] Supabase Database Linter: `auth_rls_initplan` warnings reduced to **0**.
- [ ] Lighthouse Performance Audit: Score **≥ 90**.
- [ ] Browser DevTools Performance Tab: Frame drop / long tasks reduced to **< 50ms**.
