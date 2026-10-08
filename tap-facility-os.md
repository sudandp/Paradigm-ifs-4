# Paradigm Facility OS (TAP Navigation & Module Architecture) — Implementation Plan

> **Task Slug**: `tap-facility-os`  
> **Source Blueprint**: Paradigm Facility OS Front-End SRS (`FR-001` to `FR-062`)  
> **Primary Agents**: `project-planner`, `frontend-specialist`, `backend-specialist`  
> **Primary Skills**: `clean-code`, `app-builder`, `plan-writing`, `frontend-design`, `brainstorming`  

---

## 1. Overview & Project Type

- **Project Type**: `WEB` + `MOBILE` (Dual-interface React 18 + Vite + Tailwind CSS with Capacitor v7 support).
- **Core Objective**: Implement the **TAP Navigation Bar Page** (Executive Desktop Nav Rail + Mobile Bottom Bar) and the complete routing and view architecture for the 7 Module Groups (54 pages, FR-001 to FR-062) based on the Paradigm Facility OS SRS blueprint.
- **Brand Standards**: Paradigm IFS corporate identity (Forest Green `#006B3F`, Dark Green `#005632`, Mint `#F0FDF4`, Electric Glow `#44D62C`, Slate `#0F172A`). Strict zero-purple rule.

---

## 2. Success Criteria

1. **Responsive Dual Navigation**:
   - **Desktop (1440px+)**: Sticky `TapHeaderBar` (Site switcher, live date, notifications, profile) + Collapsible `TapNavRail` with multi-tier flyout/drawer menus for all 7 module groups.
   - **Tablet (768px - 1024px)**: Responsive hamburger drawer with grouped accordion items and quick-switch tabs.
   - **Mobile (390px - 430px)**: Bottom navigation bar (`TapBottomNav`) targeting daily field staff flows (Dashboard, Tickets, Utility Logs, Checklists, More/Menu) with $\ge 44\text{px}$ touch targets.
2. **Comprehensive Route Hierarchy**: All 54 routes mapped and accessible with lazy-loaded page shells and seamless breadcrumb navigation.
3. **Design System & Component Token Parity**: Fully compliant with Paradigm design tokens (`bg-surface-canvas`, `border-subtle`, semantic badges for SLA and condition states).
4. **Integration with Existing Codebase**: Coexists cleanly with existing `App.tsx`, `authStore`, `permissionsStore`, and `apiService`.
5. **No Regressions & Zero Lint Errors**: Passes `npx tsc --noEmit` and build checks.

---

## 3. Technology Stack & Design System

- **Framework**: React 18.2.0 + TypeScript 5.9.3 + Vite 7.2.4
- **Styling**: Tailwind CSS + Custom CSS Variables matching Paradigm Forest Green tokens
- **Icons**: Lucide React
- **Animations**: Framer Motion (for smooth rail collapse, mobile drawer bottom-sheets, and active nav pill springs)
- **State Management**: Zustand (`facilityStore.ts`, `authStore.ts`, `uiSettingsStore.ts`)
- **Data Layer**: Supabase + TanStack Query + Offline Sync Service

---

## 4. Navigation Architecture & Module Taxonomy

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TapHeaderBar: Site Switcher | Live Date & Shift Status | Emergency Alerts | Notifications | User │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                 │
                   ┌─────────────────────────────┴─────────────────────────────┐
                   ▼                                                           ▼
     Desktop / Tablet Nav Rail                                   Mobile Field Staff BottomNav
     (7 Module Groups with Flyouts)                              (5 Core Field Touchpoints)
  ├── 1. Dashboards & Analytics                               ├── 1. Home / Daily Run
  │   ├── Operations Dashboard (/dashboard-operations)        ├── 2. Tickets & Snags
  │   ├── MMR Operations (/dashboard-mmr-operations)          ├── 3. Utility Logs (EB/DG/WTP/STP)
  │   ├── Water Analytics (/dashboard-analytics)              ├── 4. Checklists (HK/Lifts/Fire)
  │   ├── PM Adherence (/checklist-dashboard)                 └── 5. More Hub (All 7 Groups)
  │   ├── Stock Valuation (/dashboard-stock-management)
  │   └── Building Tower Status (/building-status)
  │
  ├── 2. Core Periodic Reports
  │   ├── Daily Management Report DMR (/dashboard-dmr)
  │   ├── Monthly Monitoring Report MMR (/dashboard-mmr)
  │   ├── Raw Telemetry Logs (/dashboard-reports)
  │   └── Checklist Audit History (/dashboard-checklist-reports)
  │
  ├── 3. Operations & Asset Management
  │   ├── Helpdesk & Resident Tickets (/support-tickets)
  │   ├── Tasks & Defect List (/apps-tasks-list-view)
  │   ├── Incidents & RCA (/apps-incident-list-view)
  │   ├── Work Orders & Quotes (/apps-work-order-list-view)
  │   ├── Master Asset Register (/apps-asset-list-view)
  │   ├── PPM Activities Calendar (/apps-ppm-list-view)
  │   ├── AMC Vendor Contracts (/apps-contract-list-view)
  │   ├── Statutory Compliance (/apps-compliance-list-view)
  │   ├── Adhoc & Scored Audits (/apps-audit-list-view)
  │   └── Products & Asset Library (/products, /asset-library)
  │
  ├── 4. Water Management (Utility Logs & Checks)
  │   ├── STP Operations & Telemetry (/service-category/logs/stp)
  │   ├── STP Shift Inspection (/service-category/checklist/stp)
  │   ├── WTP Operations & Multi-Meters (/service-category/logs/wtp)
  │   ├── WTP Inspection (/service-category/checklist/wtp)
  │   ├── Swimming Pools Chlorine/pH (/service-category/logs/pools)
  │   ├── Water Tankers Ledger (/service-category/logs/tankers)
  │   └── Rainwater Harvesting RWH (/service-category/logs/rwh)
  │
  ├── 5. Electrical Management
  │   ├── DG Operations & Fuel Ledger (/service-category/logs/dg)
  │   ├── DG Pre-Start Checklist (/service-category/checklist/dg)
  │   ├── EB Incomer & Solar Generation (/service-category/logs/eb)
  │   ├── EB Transformer Checklist (/service-category/checklist/eb)
  │   ├── Elevators & Passenger Entrapment (/service-category/checklist/lifts)
  │   └── Fire Pump Line Pressure (/service-category/checklist/fire)
  │
  ├── 6. Soft Services Checklists
  │   ├── Housekeeping 18-Zone Supervisor Audit (/service-category/checklist/housekeeping)
  │   ├── Horticulture & Gardening (/service-category/checklist/gardening)
  │   ├── Clubhouse & Amenities (/service-category/checklist/clubhouse)
  │   └── Pest Control Vendor Log (/service-category/checklist/pest-control)
  │
  └── 7. Administration & System Setup
      ├── Dynamic Checklist Builder (/settings-checklists)
      ├── Site Setup Wizard 5-Step (/onboarding-wizard)
      ├── Onboarding Progress Tracker (/onboarding-status)
      ├── Notification Escalation Matrix (/notification-settings)
      ├── IoT Hardware Gateways (/IOT)
      ├── Site Master Data & Constants (/siteconfig-data)
      ├── Shift Windows & Attendance Engine (/shift-management)
      ├── Dynamic Log Fields Designer (/log-fields)
      ├── Services Taxonomy 4-Tier (/services, /service-category-lists)
      ├── Users & RBAC (/users)
      ├── SMTP & Executive Email Digest (/company-email-config)
      └── Multi-Site Portfolio Directory (/sites-home)
```

---

## 5. File Structure Plan

```
src/
├── components/
│   └── tap/
│       ├── navigation/
│       │   ├── TapHeaderBar.tsx           # Sticky header with site switcher & emergency banner
│       │   ├── TapNavRail.tsx             # Collapsible icon rail with floating submenus
│       │   ├── TapNavMenuDrawer.tsx       # Full expandable drawer for mobile & tablet
│       │   ├── TapBottomNav.tsx           # Mobile thumb navigation bar (5 buttons + action sheet)
│       │   ├── TapBreadcrumbs.tsx         # Hierarchical route breadcrumbs with back button
│       │   └── tapNavConfig.ts            # Central navigation config (all 7 groups & 54 pages)
│       ├── layouts/
│       │   └── TapFacilityLayout.tsx      # Main layout combining header, rail/drawer, bottom nav
│       └── shared/
│           ├── StatKpiCard.tsx            # C-03: Summary metric card
│           ├── FilterToolBar.tsx          # C-04: Filter/Search controls
│           ├── MeterReadingTable.tsx      # C-06: Opening/Closing/Difference ledger table
│           ├── TankLevelGauge.tsx         # C-07: Water/Diesel tank level slider & gauge
│           ├── TelemetryControlCard.tsx   # C-08: Benchmark range gauge
│           ├── ChecklistTaskRow.tsx       # C-09: Binary OK/Not OK task row
│           ├── StatusBadgePill.tsx        # C-10: Semantic status badges
│           ├── SlideOverDrawer.tsx        # C-11: Right-anchored form drawer
│           └── EmojiRatingControl.tsx     # C-13: 5-level supervisory satisfaction score
├── pages/
│   └── tap/
│       ├── TapHubPage.tsx                 # Central landing page & quick switcher
│       ├── dashboards/                    # Module 1 pages
│       ├── reports/                       # Module 2 pages (DMR, MMR)
│       ├── operations/                    # Module 3 pages (Tickets, PPM, Assets, etc.)
│       ├── utilities/                     # Module 4 & 5 (Water & Electrical Logs & Checks)
│       ├── softservices/                  # Module 6 (Housekeeping 18-zone audit, etc.)
│       └── admin/                         # Module 7 (Checklist builder, site wizard, etc.)
└── routes/
    └── tapRoutes.tsx                      # Modular route definitions for Paradigm Facility OS
```

---

## 6. Detailed Task Breakdown

### Phase 1: Navigation Infrastructure & Configuration (Foundation)
- **Task T-01: Navigation Schema & Route Registry**
  - **Agent**: `frontend-specialist` | **Skill**: `clean-code`
  - **Input**: Front-End SRS Module Groups 1-7 (54 routes, icons, permissions, roles).
  - **Output**: `src/components/tap/navigation/tapNavConfig.ts` with type-safe metadata for every page.
  - **Verify**: Type check succeeds, all 54 routes mapped with labels and Lucide icons.

- **Task T-02: TapHeaderBar & Site Context Bar**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **Input**: Header specs (`C-01`: Site switcher dropdown, date filter, status badges, notification bell, profile).
  - **Output**: `src/components/tap/navigation/TapHeaderBar.tsx`.
  - **Verify**: Header renders with sticky positioning, dropdown selects active site, responsive on desktop and mobile.

- **Task T-03: TapNavRail (Desktop Persistent Rail & Flyouts)**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **Input**: Collapsible rail specs (`C-02`), Paradigm green branding, hover flyout drawers.
  - **Output**: `src/components/tap/navigation/TapNavRail.tsx`.
  - **Verify**: Smooth collapse toggle, active indicator pill with Framer Motion, nested flyouts appear on hover/click.

- **Task T-04: TapBottomNav & Mobile Action Sheet**
  - **Agent**: `frontend-specialist` | **Skill**: `mobile-design`
  - **Input**: Mobile navigation specs ($\ge 44\text{px}$ touch targets, bottom bar, Quick Action "+" button for meter reading/ticket).
  - **Output**: `src/components/tap/navigation/TapBottomNav.tsx`.
  - **Verify**: Renders at `< 768px`, active spring pill animation, haptic-friendly layout.

- **Task T-05: TapFacilityLayout Shell & Hub Page**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **Input**: Master container combining Header, Rail, Breadcrumbs, Content `<Outlet />`, and BottomNav.
  - **Output**: `src/components/tap/layouts/TapFacilityLayout.tsx` and `src/pages/tap/TapHubPage.tsx`.
  - **Verify**: Responsive breakpoint switches seamlessly between Desktop Rail and Mobile BottomNav.

### Phase 2: Route Integration & Core Shared UI Components
- **Task T-06: Tap Routes Integration in `App.tsx`**
  - **Agent**: `frontend-specialist` | **Skill**: `clean-code`
  - **Input**: Layout shell and route declarations.
  - **Output**: `src/routes/tapRoutes.tsx` mounted in `App.tsx` under `/facility-os/*` or `/tap/*`.
  - **Verify**: Navigating to `/facility-os` renders TapFacilityLayout with TapHubPage without breaking existing routes.

- **Task T-07: Core UI Component Library (C-03 to C-14)**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **Input**: Specs for `StatKpiCard`, `MeterReadingTable`, `TankLevelGauge`, `ChecklistTaskRow`, `EmojiRatingControl`, `StatusBadgePill`.
  - **Output**: Components created under `src/components/tap/shared/`.
  - **Verify**: Components adhere to WCAG AA color contrast, responsive typography, and Paradigm brand colors.

### Phase 3: Module Page Shells & Key Workflows
- **Task T-08: Executive DMR & Operations Dashboard Shells**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **Input**: FR-001 to FR-003, FR-011 to FR-014 (Manpower summary, water balance, DG fuel ledger, elevator breakdown).
  - **Output**: `src/pages/tap/reports/DmrDashboardPage.tsx` and `src/pages/tap/dashboards/OperationsDashboardPage.tsx`.
  - **Verify**: Net water balance calculation displayed, manpower attendance synced, PDF/Excel export button bar present.

- **Task T-09: Utility Logs Shells (Water STP/WTP & Electrical EB/DG)**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **Input**: FR-036 to FR-042 (Opening/Closing meter readings, Multiplying Factor, tank gauges, SFC).
  - **Output**: `StpLogsPage.tsx`, `WtpLogsPage.tsx`, `DgLogsPage.tsx`, `EbLogsPage.tsx`.
  - **Verify**: Meter reading table calculates daily consumption automatically; warning banners trigger on out-of-range readings.

- **Task T-10: Soft Services & Housekeeping 18-Zone Checklist**
  - **Agent**: `frontend-specialist` | **Skill**: `mobile-design`
  - **Input**: FR-045, FR-046 (18 verbatim zones, binary OK/Not OK, geofence stamp, duration timer, 5-emoji rating).
  - **Output**: `src/pages/tap/softservices/HousekeepingChecklistPage.tsx`.
  - **Verify**: 18 checklist rows render with fast binary taps, timer counts inspection duration, emoji picker stores rating.

---

## 7. Phase X: Verification & Quality Assurance

- [ ] **TypeScript Check**: `npx tsc --noEmit` returns 0 compilation errors.
- [ ] **Lint Check**: Code strictly adheres to repository ESLint standards.
- [ ] **Brand Identity Check**: No purple/violet `#...` hex codes. Exclusively Paradigm Forest Green `#006B3F` and emerald accents.
- [ ] **Touch Target Audit**: Mobile nav icons and checklist buttons maintain $\ge 44\text{px}$ click area.
- [ ] **Responsive Test**: Verified on 1440px desktop, 1024px tablet, and 390px mobile viewports.
