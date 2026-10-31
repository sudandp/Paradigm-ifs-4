# Paradigm Gate & Community OS (MyGate Full Replication) — Master Architecture & Implementation Plan

> **Task Slug**: `paradigm-gate-community-os`  
> **Source Target**: Full MyGate Feature Parity (Gate Kiosk, Resident App, Facility Admin)  
> **Primary Agents**: `orchestrator`, `project-planner`, `backend-specialist`, `frontend-specialist`, `mobile-developer`  
> **Primary Skills**: `clean-code`, `app-builder`, `plan-writing`, `frontend-design`, `mobile-design`, `api-patterns`  
> **Target Platforms**: Dual Web & Mobile (React 18 + Vite + Capacitor v7 for Android/iOS)  
> **Backend Authority**: Supabase Cloud Platform + Exotel Telephony + Offline SQLite/IndexedDB  

---

## 1. Executive Blueprint & Core Decisions

| Decision Area | Specification / Chosen Pattern |
| :--- | :--- |
| **System Identity** | **Paradigm Gate & Community OS** (Unified with Paradigm Facility OS & TAP Navigation) |
| **Brand Standards** | Strict Forest Green (`#006B3F`), Dark Green (`#005632`), Mint (`#F0FDF4`), Electric Glow (`#44D62C`), Slate (`#0F172A`). **Zero purple rule enforced.** |
| **Resident Approval** | **Dual Pipeline**: Realtime App Push (Supabase Realtime + FCM/APNs). If unacknowledged within **45 seconds**, triggers an automated **Exotel Telephony IVR Call** (*"Press 1 to allow, 2 to deny"*). |
| **Gate Resilience** | **Offline-First Guard Kiosk**: IndexedDB (Web/PWA) & SQLite (Capacitor). Full offline visitor logging, number plate search, and badge generation with background auto-sync to Supabase. |
| **Shift Engine Link** | Gate security guards are mapped directly to Paradigm's **Dynamic Shift Engine** (Shift A, B, C, DAY-12, NIGHT-12 with debounced punches). |

---

## 2. Three-Tier Interface Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          PARADIGM GATE & COMMUNITY ECOSYSTEM                           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼────────────────────────────────────┐
        ▼                                   ▼                                    ▼
┌─────────────────────────┐     ┌─────────────────────────┐          ┌─────────────────────────┐
│     1. GUARD KIOSK      │     │    2. RESIDENT APP      │          │   3. ADMIN & OPS DESK   │
│  (Tablet / Gate Phone)  │     │   (Mobile / Android)    │          │      (Desktop Web)      │
├─────────────────────────┤     ├─────────────────────────┤          ├─────────────────────────┤
│ • Quick Entry Buttons:  │     │ • 1-Tap Entry Approval  │          │ • Unit & Flat Directory │
│   Guest / Cab / Delivery│       (Realtime banner + Push)│          │ • Resident/Tenant Roster│
│   Daily Help / Vendor   │     │ • Pre-Invite Guests     │          │ • Security Guard Rosters│
│ • Number Plate OCR &    │       (Dynamic QR Code)       │          │ • Move In/Out Clearances│
│   Fastag/RFID Lookup    │     │ • Daily Help Roster     │          │ • Material Gate Passes  │
│ • Offline Cache Engine  │       (Maid/Driver In-Society)│          │ • Maintenance Invoicing │
│ • Guard Patrol Scanner  │     │ • Material Gate Pass    │          │ • Incident Management   │
│   (NFC / QR + GPS)      │     │ • Amenity Booking       │          │ • Telephony/IVR Logs    │
│ • Emergency Panic / SOS │     │ • Community Notices     │          │ • Overstay Analytics    │
└───────────┬─────────────┘     └───────────┬─────────────┘          └───────────┬─────────────┘
            │                               │                                    │
            └───────────────────────────────┼────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PARADIGM SUPABASE CLOUD & EXOTEL                                │
│ • Realtime Pub/Sub: `gate_entries`, `sos_alerts`, `intercom_events`                    │
│ • Telephony Automation: Exotel Outbound Voice Webhook (45s Fallback)                   │
│ • Database Engine: PostgreSQL RLS + Offline Sync Ledger + Shift Engine                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema (PostgreSQL / Supabase)

### 3.1. Society Topology & Units (`gate_units`)
```sql
CREATE TABLE public.gate_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    block_tower VARCHAR(50) NOT NULL,
    floor_number INT,
    unit_number VARCHAR(50) NOT NULL,
    intercom_code VARCHAR(20),
    area_sqft NUMERIC(10, 2),
    occupancy_status VARCHAR(20) DEFAULT 'occupied' CHECK (occupancy_status IN ('occupied', 'vacant', 'under_renovation')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(site_id, block_tower, unit_number)
);
```

### 3.2. Residents & Household Members (`gate_residents`)
```sql
CREATE TABLE public.gate_residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.gate_units(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    resident_type VARCHAR(20) NOT NULL CHECK (resident_type IN ('owner', 'tenant', 'family_member')),
    is_primary BOOLEAN DEFAULT FALSE,
    fcm_device_token TEXT,
    ivr_opt_in BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3. Daily Staff & Domestic Helpers (`gate_daily_helpers`)
```sql
CREATE TABLE public.gate_daily_helpers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    helper_code VARCHAR(30) UNIQUE NOT NULL, -- e.g. DH-8821
    full_name VARCHAR(150) NOT NULL,
    helper_type VARCHAR(50) NOT NULL, -- 'Maid', 'Cook', 'Driver', 'Gardener', 'Nanny'
    phone VARCHAR(20),
    photo_url TEXT,
    id_proof_number VARCHAR(100),
    police_verified BOOLEAN DEFAULT FALSE,
    current_status VARCHAR(20) DEFAULT 'outside' CHECK (current_status IN ('inside', 'outside')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.gate_helper_unit_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    helper_id UUID NOT NULL REFERENCES public.gate_daily_helpers(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.gate_units(id) ON DELETE CASCADE,
    rating NUMERIC(2, 1) DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(helper_id, unit_id)
);
```

### 3.4. Master Visitor & Gate Logs (`gate_entries`)
```sql
CREATE TABLE public.gate_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.gate_units(id) ON DELETE SET NULL,
    visitor_type VARCHAR(30) NOT NULL CHECK (visitor_type IN ('guest', 'cab', 'delivery', 'daily_help', 'service_technician', 'vendor')),
    visitor_name VARCHAR(150) NOT NULL,
    visitor_phone VARCHAR(20),
    vehicle_number VARCHAR(30),
    company_name VARCHAR(100), -- Swiggy, Zomato, Amazon, Uber, Urban Company
    entry_gate_name VARCHAR(50) NOT NULL,
    exit_gate_name VARCHAR(50),
    guard_user_id UUID REFERENCES public.users(id),
    visitor_photo_url TEXT,
    entry_time TIMESTAMPTZ DEFAULT NOW(),
    exit_time TIMESTAMPTZ,
    
    -- Dual Approval Engine
    approval_status VARCHAR(30) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'denied', 'auto_preapproved', 'guard_override')),
    approved_by_resident_id UUID REFERENCES public.gate_residents(id),
    approval_channel VARCHAR(30) CHECK (approval_channel IN ('app_push', 'exotel_ivr', 'guard_phone_call', 'pre_invite_qr')),
    approval_timestamp TIMESTAMPTZ,
    exotel_call_sid VARCHAR(100),
    ivr_call_status VARCHAR(30), -- 'ringing', 'completed', 'no_answer', 'failed'
    
    -- Offline Sync Engine
    offline_id VARCHAR(100),
    is_synced BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.5. Material Movement & Gate Passes (`gate_material_passes`)
```sql
CREATE TABLE public.gate_material_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.gate_units(id),
    pass_number VARCHAR(50) UNIQUE NOT NULL,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('inward', 'outward', 'move_in', 'move_out')),
    is_returnable BOOLEAN DEFAULT FALSE,
    expected_return_date DATE,
    items_description JSONB NOT NULL, -- [{ item: 'Sofa', qty: 1 }, { item: 'Laptop', qty: 2, serial: 'XYZ' }]
    transporter_name VARCHAR(100),
    vehicle_number VARCHAR(30),
    office_noc_approved BOOLEAN DEFAULT FALSE,
    status VARCHAR(30) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'gate_verified', 'completed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.6. Guard Patrol & Checkpoints (`gate_patrol_logs`)
```sql
CREATE TABLE public.gate_patrol_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    checkpoint_code VARCHAR(50) NOT NULL,
    checkpoint_name VARCHAR(150) NOT NULL, -- e.g. "Basement 2 Fire Exit North"
    qr_hash VARCHAR(100) NOT NULL,
    nfc_tag_uid VARCHAR(100),
    expected_latitude NUMERIC(10, 7),
    expected_longitude NUMERIC(10, 7),
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE public.gate_patrol_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    checkpoint_id UUID NOT NULL REFERENCES public.gate_patrol_checkpoints(id),
    guard_id UUID NOT NULL REFERENCES public.users(id),
    scan_time TIMESTAMPTZ DEFAULT NOW(),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_within_geofence BOOLEAN DEFAULT TRUE,
    remarks TEXT
);
```

---

## 4. Dual Approval Engine: Supabase Realtime + Exotel IVR Fallback

### 4.1. Lifecycle Sequence
```
Guard Logs Visitor at Gate
         │
         ▼
Insert into `gate_entries` (status: 'pending')
         │
         ├───► 1. Supabase Realtime Event broadcasted to Resident App
         ├───► 2. Capacitor / FCM High-Priority Push sent to Resident Phone
         │
         ▼
[Timer: 45 Seconds Countdown Initiated]
         │
         ├── Resident taps "Approve" / "Deny" within 45s:
         │      ├── Update `gate_entries.approval_status = 'approved'`
         │      ├── Set `approval_channel = 'app_push'`
         │      ├── Guard Tablet screen updates instantly (Electric Green)
         │      └── CANCEL IVR Fallback Timer.
         │
         └── Resident does NOT respond after 45s:
                ▼
Trigger Exotel Outbound Voice Call via Edge Function
                │
                ├── Call Resident Primary Mobile Number
                ├── Automated Prompt: "Visitor [Name] is at Gate 1 for Flat [102]. Press 1 to allow, 2 to deny."
                ├── Resident presses DTMF tone (1 or 2):
                │      ├── Webhook received: `/api/exotel-ivr-response`
                │      ├── Update `gate_entries.approval_status = 'approved'` (or 'denied')
                │      └── Guard Tablet notified in real-time.
```

---

## 5. Offline-First Guard Kiosk Resilience

1. **Local Schema Cache**:
   - On login, the Guard Kiosk downloads an offline snapshot of:
     - `gate_units` (flat numbers and intercoms)
     - `gate_residents` (names, numbers, vehicle numbers for Fastag matching)
     - `gate_daily_helpers` (maid/driver photos and active status)
   - Stored in browser IndexedDB (or SQLite via `@capacitor-community/sqlite`).
2. **Offline Logging**:
   - Guard can check-in visitors even with complete Wi-Fi loss.
   - System assigns temporary `offline_id = 'OFFLINE_' + timestamp + '_' + random`.
   - Gate badge QR is rendered and printed locally via Bluetooth thermal printer.
3. **Delta Sync Protocol**:
   - Network listener monitors `navigator.onLine` and ping health.
   - When connection returns, an atomic queue syncs pending logs via RPC `sync_offline_gate_entries`.

---

## 6. Implementation Phases & Deliverables

| Phase | Duration | Core Deliverables |
| :--- | :--- | :--- |
| **Phase 1: DB Schema & Edge Functions** | Days 1–3 | Supabase migration for all 6 `gate_*` tables, RLS policies, and Exotel webhook endpoints. |
| **Phase 2: Offline Guard Kiosk (Tablet UI)** | Days 4–7 | High-speed touch UI with quick-actions (Guest, Cab, Delivery, Maid), offline IndexedDB cache, search by Flat or Vehicle number. |
| **Phase 3: Dual Approval & Exotel IVR Engine** | Days 8–10 | Supabase Realtime subscription + Push + 45s timer edge function triggering Exotel IVR call with DTMF parse. |
| **Phase 4: Resident Mobile Touchpoint** | Days 11–13 | Resident Portal screen: Instant visitor approval modal, Pre-invite QR creator, Daily Help tracker, and Maid entry notifications. |
| **Phase 5: Material Gate Pass & Patrol System** | Days 14–16 | Inward/Outward gate passes, Move-In/Move-Out clearance, and Guard QR patrol scanner with geofence validation. |
| **Phase 6: Desktop Admin Console & Shift Sync** | Days 17–19 | Facility Manager oversight dashboard, overstay alerts, guard attendance sync with Paradigm Shift Engine, and audit logs. |

---

## 7. Verification & Testing Protocol

1. **Offline Gate Test**: Disconnect network on guard tablet -> Log 5 entries -> Reconnect network -> Verify all 5 entries appear in Supabase without duplicates.
2. **IVR Fallback Test**: Trigger entry -> Do not click app notification -> Verify Exotel automated phone call triggers at exactly 45s -> Press 1 -> Verify guard kiosk switches to approved.
3. **Vehicle Lookup Test**: Input vehicle plate `KA03AB1234` -> Confirm flat number and resident details load in $< 200\text{ms}$.
4. **Shift Engine Audit**: Verify guard punches at the gate reflect in `dbo.AttendanceLogs` with correct Shift A/B/C or 12h Day/Night assignment.
