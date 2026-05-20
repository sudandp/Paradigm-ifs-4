# Paradigm Integrated Field Services (IFS) 4.0 — Technical Codebase Summary

This document serves as the technical source of truth for the **Paradigm IFS** codebase. It outlines the architectural design, database schemas, state management, offline-first mechanisms, security models, build configurations, and development guidelines to enable future developers and agent systems to extend the application.

---

## 1. System Overview & Objectives
**Paradigm IFS 4.0** is an enterprise-grade ERP and Employee Onboarding system designed to run as a **high-performance web application** (deployed on Vercel) and a **cross-platform native mobile application** (Android and iOS via Capacitor v7). 

Its main objectives are:
1. **Onboarding & HR Management**: Digital collection of employee documentation, UAN/ESI registrations, uniform sizes, bank details, and automated PDF contracts.
2. **Offline-First Geofenced Attendance**: Allowing field employees to punch in/out, log breaks, and request overtime in remote areas without internet coverage, with automatic synchronization when online.
3. **Face Verification**: Biometric face authentication using local models to prevent buddy punching.
4. **CRM & Field Service Operations**: Supporting site surveys, client contract management, support ticket systems, lead trackers, uniform distribution, and cost/billing analyses.

---

## 2. Tech Stack & Tooling

### Frontend Core
- **Framework**: React `18.2.0`
- **Build Tool**: Vite `7.2.4`
- **Programming Language**: TypeScript `5.9.3`
- **Styling**: Tailwind CSS `4.1.18` (utility-first CSS with CSS-based styling configuration)
- **Transitions/Animations**: Framer Motion for premium micro-animations

### State Management & Caching
- **Global Client State**: Zustand (stores managed under `store/`)
- **Global Server State & Queries**: TanStack Query (React Query) for API data caching, manual prefetching, and optimistic UI updates

### Backend & API
- **Primary Backend DB**: Supabase (PostgreSQL, Supabase Auth, Supabase Storage)
- **Production Serverless Endpoints**: Vercel Serverless Functions (`api/`) written in TypeScript (handles email dispatching, scheduled emails, and secure file proxying)
- **Development Server**: Express.js server (`src/server.ts`) running locally via ts-node, mirroring Vercel serverless routes
- **Email System**: Nodemailer with SMTP transport

### Mobile Integration (Capacitor v7.4.4)
- `@capacitor/core`, `@capacitor/android`, `@capacitor/ios`
- `@capacitor/network`: Listeners for connection state changes to automatically trigger synchronization
- `@capacitor/preferences`: Storage for local app tokens and user settings
- `@capacitor/push-notifications`: Firebase Cloud Messaging (FCM) integration
- `@capacitor-community/sqlite`: Native database for offline outbox storage
- `@capacitor-community/social-login`: Google OAuth native sign-in handler

### Machine Learning & Verification
- `@vladmandic/face-api`: In-browser face detection and comparison (matching Float32Array descriptors)
- Google Gemini Pro (via `@google/generative-ai`): AI-powered document verification and optical character recognition (OCR)

---

## 3. Directory Structure Map

```
├── .agent/                    # Antigravity Kit architecture rules & skills
├── android/                   # Native Android Studio Capacitor project
├── ios/                       # iOS Xcode Capacitor configuration
├── api/                       # Vercel Serverless Functions
│   ├── send-email.ts          # Rate-limited email endpoint via Nodemailer
│   ├── view-file.ts           # Storage proxy with case-insensitive filename fallback
│   └── process-email-schedules.ts # Cron-triggered email queue processor
├── prisma/                    # Relational ORM schema directory (empty schema.prisma)
├── public/                    # Static assets, face-api weights, and PWA icons
├── supabase/                  # Supabase database structures & configuration
│   ├── schema.sql             # SQL DB Schema containing table, trigger, and RLS definitions
│   └── migrations/            # DB Migrations
├── src/                       # Application source folder
│   ├── server.ts              # Local Express development server
│   ├── App.tsx                # Routing, Capacitor lifecycle handlers, and updating checks
│   ├── index.tsx              # Web mount entrypoint, PWA service worker registar
│   ├── components/            # Shared components and sub-modules
│   │   ├── attendance/        # Punch action, face auth, geofencing, and kiosk panels
│   │   ├── crm/               # Leads, site surveys, and quotation builders
│   │   ├── operations/        # Maintenance schedulers and contract manager components
│   │   ├── billing/           # Rates and cost dashboard panels
│   │   ├── hr/                # Onboarding form steps (1-9)
│   │   └── ui/                # Base design tokens (buttons, modals, tables, badges)
│   ├── pages/                 # Full dashboard pages mapped to React Router paths
│   ├── services/              # API interfaces and native SDK connectors
│   │   ├── api.ts             # Main API client (converts snake_case to camelCase)
│   │   ├── supabase.ts        # Client initialization
│   │   ├── notificationService.ts # In-app notification rules and FCM push
│   │   └── offline/           # Offline Database, Sync Engine, & Attendance Service
│   ├── store/                 # Zustand global stores (authStore, notificationStore, etc.)
│   ├── utils/                 # Utility files (secureStorage, faceUtils, dateHelpers)
│   └── types/                 # TypeScript typings
```

---

## 4. Key Modules & Functional Description

### 1. Onboarding & HR Module (`src/components/hr/`)
A multi-step employee enrollment wizard that supports offline drafting and manual verification checks:
- **Form Steps**:
  1. **Personal Information**: Name, DOB, Aadhaar, PAN, marital status, and profile photo upload.
  2. **Address & KYC**: Permanent/present address validation.
  3. **Family Details**: Nominee settings, parents, spouse, children.
  4. **Education & Work Experience**: Academic qualifications, previous employer details.
  5. **Bank Credentials**: Account number, IFSC code, and canceled check verification.
  6. **GMC & Insurance**: Policy enrollee selection, medical forms.
  7. **ESI & PF Configuration**: UAN numbers and ESI declarations.
  8. **Uniform Sizing**: Pants, shirts, safety shoes specifications.
  9. **Review & Sign**: Final signoff, triggers document OCR validation.
- **Form State**: Managed using `react-hook-form` with strict type validation via `yup`.
- **AI OCR Integration**: Uploaded documents are parsed via Gemini Pro to match inputs (e.g., matching name on Aadhaar to form fields) and sets a `requiresManualVerification` flag if discrepancies are found.

### 2. Attendance & Geofencing Module (`src/components/attendance/`)
- **Geofencing**: Users fetch a list of authorized locations. Standard distance calculations verify if GPS coordinates fall inside the designated location's `radius` (e.g. 50-100 meters).
- **Face Auth**: Encrypted Float32Array face descriptors are cached locally in SQLite/IndexedDB. Camera feeds match real-time face captures against cached templates using local `@vladmandic/face-api` model weights stored under `/public/models/`.
- **Kiosk Attendance Mode**: Attendance kiosks run at physical gates using `KioskPlugin` checks. Employees punch in using a QR Code badge.

### 3. Client Dashboard & CRM Module (`src/components/crm/`)
- **Lead Pipeline**: Tracks CRM leads from prospecting through conversion.
- **Site Survey**: Mobile survey forms allowing field officers to log site layout details, photos, and requirements.
- **Quotation Builder**: Auto-calculates client quotes based on manpower size, tax configurations, and equipment margins.

### 4. Support Ticket System (`src/pages/support/`)
- Modular helpdesk system for technical support.
- Supports rich ticketing threads with parent posts, comments, likes, attachments, status states (Open, In Progress, Resolved, Closed), and priority categories.

---

## 5. Offline-First & Synchronization Design
Designed to handle poor cellular connectivity in remote field settings.

### Database Layer (`src/services/offline/database.ts`)
- **IndexedDB**: Used on web platforms via the `idb` library.
- **SQLite**: Used on native mobile devices via `@capacitor-community/sqlite` for performance and database integrity.
- **Outbox Queue (`outbox` table)**: Records data mutating operations (INSERT, UPDATE, DELETE) containing:
  - `table_name`: Target database table
  - `action`: Operations (e.g., INSERT, UPDATE)
  - `payload`: Row data JSON object
  - `timestamp`: Authoritative client creation timestamp
  - `status`: `pending` | `syncing` | `failed`
- **Cache Engine (`cache` table)**: Caches static settings, geofencing data, user profiles, and attendance histories to allow instant application rendering when offline.
- **Retention**: Cache entries older than 3 months are auto-purged. Completed outbox logs are periodically truncated to control storage usage.

### Sync Engine (`src/services/offline/syncService.ts`)
- **Connectivity Trigger**: Listens for connection transitions using `@capacitor/network`. Reconnection triggers an immediate outbox sync.
- **Interval Sync**: Auto-runs a background sync task every 60 seconds.
- **Outbox Processing**:
  1. Iterates through pending items ordered by client timestamp.
  2. Implements **Exponential Backoff** and skips retrying failed actions for up to 60 seconds (max 5 retries, then marks as `failed`).
  3. Translates Outbox records into API calls (e.g., `api.addAttendanceEvent`).
  4. Idempotency handling: Ignores duplicate primary key / unique constraint database errors (HTTP 409) to avoid double punch syncs.
- **Data Pulling**: Once outbox items are synced, the engine fetches latest user profiles, leave balances, geofences, and tasks from Supabase to sync local caches.

### Attendance Wrapper (`src/services/offline/offlineAttendanceService.ts`)
- Integrates with the network status:
  - **Online**: Directly calls API + appends event to the local Cache.
  - **Offline**: Validates that outbox size is under `1000` items (warns at `800`), pushes the action to the outbox queue, and immediately updates the local cache. The UI reacts instantaneously, displaying a "Pending Sync" indicator.
- Caches today's events, monthly attendance histories, user geofences, and profile datasets.

### Offline Auth Restoration (`src/App.tsx`)
- On startup, the application verifies the connection. If offline, the app searches local secure cache for the last active user profile (`current_user`).
- **14-day Window**: Permits offline application access for up to 14 days since the last recorded online timestamp. If exceeded, it invalidates the session and prompts re-login.

---

## 6. Database Schema Summary (`supabase/schema.sql`)
Key database schemas and fields:

- **`public.users`**: Extends auth metadata. Links user IDs to roles, phone numbers, and organizations.
  - `id` UUID PK (joins `auth.users.id`)
  - `role_id` TEXT DEFAULT 'unverified'
  - `organization_id` TEXT
  - `reporting_manager_id` UUID
- **`public.attendance_events`**: Tracks check-in/out logs.
  - `user_id` UUID, `timestamp` TIMESTAMPTZ, `type` TEXT (e.g., check_in, check_out, break_start)
  - `latitude` / `longitude` DOUBLE PRECISION, `location_id` UUID
- **`public.attendance_approvals`**: Requests requiring manual validation by managers.
- **`public.onboarding_submissions`**: Stores employee onboarding wizard records as massive JSONB objects (e.g., `personal`, `family`, `bank`, `uan`, `esi`). Helps avoid schema migrations when form fields adjust.
- **`public.settings`**: Single row table storing global systems variables (OTP rules, Gemini configurations, uniform inventory types) as JSONB columns.
- **`public.leave_requests`**: Start/end dates, leave types, status, and approval history logs.
- **`public.tasks`**: Assigned task details, due dates, completion photos, and multi-tier escalation parameters.
- **`public.support_tickets`** / **`public.ticket_posts`**: Support desk message structure.
- **`public.extra_work_logs`** / **`public.comp_off_logs`**: Overtime and comp-off balances.

---

## 7. State Flow & API Communication

### Data Flow Pattern
```
             ┌─────────────────────────────┐
             │       Zustand Stores        │
             │   (authStore, onboarding)   │
             └─────────────────────────────┘
                ▲                       ▲
     Write Local│                       │State Update
                │                       │
      ┌──────────────────┐     ┌──────────────────┐
      │   Offline Cache  │     │   React Query    │
      │  (IndexedDB/SQL) │     │ (Server Caching) │
      └──────────────────┘     └──────────────────┘
                ▲                       ▲
     Offline Run│              Online   │
                │                       │
         ┌─────────────┐         ┌─────────────┐
         │ Sync Outbox │────────▶│ Supabase DB │
         │   Queue     │ Sync    │   Engine    │
         └─────────────┘         └─────────────┘
```

### SnakeCase to CamelCase Conversion
- The database tables and columns are defined in `snake_case`.
- The frontend React client relies on `camelCase`.
- **`services/api.ts`** intercepts responses and utilizes `api.toCamelCase()` to normalize data shapes during fetches. Always wrap raw responses using this utility.

---

## 8. Security & Environment Architecture

### 1. Token Encryption (`src/utils/secureStorage.ts`)
- Long-term remember-me refresh tokens, remembered emails, and face templates are **AES-256 encrypted** using a device-specific key before writing to `@capacitor/preferences` (Preferences API) or browser `localStorage`.

### 2. RLS Security vs Service Role Key
- **Client Application**: Uses `VITE_SUPABASE_ANON_KEY`. Restricted by Postgres **Row Level Security (RLS)**. Queries are filtered based on the active user’s authentication JWT.
- **Serverless API / Dev Proxy**: Uses the un-prefixed `SUPABASE_SERVICE_ROLE_KEY`. Bypasses RLS to execute administrative functions (e.g. creating/fetching email lists, administrative approvals, and parsing files). 
- *Caution: Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `VITE_` to ensure it is not compiled into frontend web bundles.*

### 3. Server Rate Limiting
- The Express/Vercel serverless email endpoint implements an in-memory rate-limiter allowing a maximum of **20 requests per 15 minutes** per client IP, mitigating spam and resource exhaustion attacks.

### 4. TLS Certificate Validation
- Local Express development has TLS validation active by default (removing legacy self-signed bypasses like `NODE_TLS_REJECT_UNAUTHORIZED = '0'`) to enforce secure HTTPS proxy links.

---

## 9. Developer Guidelines & Architectural Gotchas

### 🚨 Supabase Auth onAuthStateChange Callback Lockup
**Critical Issue**: Awaiting asynchronous database calls directly inside the `supabase.auth.onAuthStateChange` handler will hang the client when users reload the app or swap tabs.
- **Rule**: Never run async awaits inside the auth state listener callback loop directly.
- **Fix**: Wrap all asynchronous operations (e.g. profile queries or push notifications setups) inside a `setTimeout(() => { ... }, 0)` call to run them in the next tick of the event loop.

### 🔌 Capacitor Safe Guards
- Check `Capacitor.isNativePlatform()` before triggering native APIs (such as local push configuration, orientation settings, and App update checks) to prevent runtime crashes in browser builds.

### 🧭 Navigation & Haptics
- Core events like checking in, logging out, or submission errors trigger native haptic responses using standard vibration profiles to provide tactile user feedback.
- In native platforms, routing utilizes a **HashRouter** config rather than `BrowserRouter` to ensure pages load successfully from static files packaged inside Capacitor assets folders.
