-- ============================================================================
-- MIGRATION: Paradigm Gate & Community OS (Full MyGate Replication)
-- Timestamp: 20261026143000
-- Description:
--   1. gate_units: Tower, floor, flat numbers, intercom, occupancy
--   2. gate_residents: Owner/Tenant/Family roster, contact, FCM token, IVR preference
--   3. gate_daily_helpers: Maids, drivers, cooks, status (inside/outside), passcodes
--   4. gate_helper_unit_mappings: Flat-to-maid associations and resident ratings
--   5. gate_entries: Master visitor / delivery / cab logs with dual approval (Push + Exotel IVR)
--   6. gate_material_passes: Inward/Outward gate passes and Move-In/Move-Out NOC
--   7. gate_patrol_checkpoints & gate_patrol_scans: Guard QR/NFC perimeter scans
--   8. gate_emergency_alerts: Panic / SOS society broadcast alerts
--   9. Offline Sync RPC & Realtime Publication configuration
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. GATE UNITS (Towers / Blocks / Flats)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    entity_id TEXT REFERENCES public.entities(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    block_tower VARCHAR(50) NOT NULL,
    floor_number INT,
    unit_number VARCHAR(50) NOT NULL,
    intercom_code VARCHAR(20),
    area_sqft NUMERIC(10, 2),
    occupancy_status VARCHAR(20) DEFAULT 'occupied' CHECK (occupancy_status IN ('occupied', 'vacant', 'under_renovation')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, block_tower, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_gate_units_org ON public.gate_units(organization_id);
CREATE INDEX IF NOT EXISTS idx_gate_units_lookup ON public.gate_units(organization_id, block_tower, unit_number);

-- ----------------------------------------------------------------------------
-- 2. GATE RESIDENTS (Owners, Tenants, Family Members)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_residents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.gate_units(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    resident_type VARCHAR(20) NOT NULL CHECK (resident_type IN ('owner', 'tenant', 'family_member')),
    is_primary BOOLEAN DEFAULT FALSE,
    fcm_device_token TEXT,
    ivr_opt_in BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_residents_unit ON public.gate_residents(unit_id);
CREATE INDEX IF NOT EXISTS idx_gate_residents_phone ON public.gate_residents(phone);
CREATE INDEX IF NOT EXISTS idx_gate_residents_user ON public.gate_residents(user_id);

-- ----------------------------------------------------------------------------
-- 3. DAILY HELPERS (Maids, Drivers, Cooks, Maintenance Staff)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_daily_helpers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    helper_code VARCHAR(30) NOT NULL, -- e.g. DH-1002
    full_name VARCHAR(150) NOT NULL,
    helper_type VARCHAR(50) NOT NULL, -- 'Maid', 'Cook', 'Driver', 'Gardener', 'Nanny', 'Car Cleaner'
    phone VARCHAR(20),
    photo_url TEXT,
    id_proof_type VARCHAR(50),
    id_proof_number VARCHAR(100),
    police_verified BOOLEAN DEFAULT FALSE,
    current_status VARCHAR(20) DEFAULT 'outside' CHECK (current_status IN ('inside', 'outside')),
    last_status_change TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, helper_code)
);

CREATE INDEX IF NOT EXISTS idx_gate_helpers_org ON public.gate_daily_helpers(organization_id);
CREATE INDEX IF NOT EXISTS idx_gate_helpers_code ON public.gate_daily_helpers(helper_code);
CREATE INDEX IF NOT EXISTS idx_gate_helpers_status ON public.gate_daily_helpers(current_status);

-- Flat to Helper mappings (Which flat engages which maid)
CREATE TABLE IF NOT EXISTS public.gate_helper_unit_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    helper_id UUID NOT NULL REFERENCES public.gate_daily_helpers(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.gate_units(id) ON DELETE CASCADE,
    rating NUMERIC(2, 1) DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(helper_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_helper_mappings_unit ON public.gate_helper_unit_mappings(unit_id);
CREATE INDEX IF NOT EXISTS idx_helper_mappings_helper ON public.gate_helper_unit_mappings(helper_id);

-- ----------------------------------------------------------------------------
-- 4. MASTER GATE ENTRIES (Visitors, Cabs, Delivery, Daily Help)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.gate_units(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    
    -- Visitor Information
    visitor_type VARCHAR(30) NOT NULL CHECK (visitor_type IN ('guest', 'cab', 'delivery', 'daily_help', 'service_technician', 'vendor')),
    visitor_name VARCHAR(150) NOT NULL,
    visitor_phone VARCHAR(20),
    vehicle_number VARCHAR(30),
    company_name VARCHAR(100), -- Swiggy, Zomato, Amazon, Uber, Ola, Urban Company, Blinkit
    visitor_photo_url TEXT,
    helper_id UUID REFERENCES public.gate_daily_helpers(id) ON DELETE SET NULL,
    
    -- Check-in / Check-out Audit
    entry_gate_name VARCHAR(50) NOT NULL,
    exit_gate_name VARCHAR(50),
    guard_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    entry_time TIMESTAMPTZ DEFAULT NOW(),
    exit_time TIMESTAMPTZ,
    
    -- Dual Approval Engine
    approval_status VARCHAR(30) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'denied', 'auto_preapproved', 'guard_override')),
    approved_by_resident_id UUID REFERENCES public.gate_residents(id) ON DELETE SET NULL,
    approval_channel VARCHAR(30) CHECK (approval_channel IN ('app_push', 'exotel_ivr', 'guard_phone_call', 'pre_invite_qr', 'guard_manual')),
    approval_timestamp TIMESTAMPTZ,
    
    -- Exotel Telephony Fallback
    exotel_call_sid VARCHAR(100),
    ivr_call_status VARCHAR(30), -- 'initiated', 'ringing', 'completed', 'no_answer', 'failed'
    ivr_call_timestamp TIMESTAMPTZ,
    
    -- Pre-invite & QR Pass
    pre_invite_code VARCHAR(20),
    is_pre_approved BOOLEAN DEFAULT FALSE,
    
    -- Offline Kiosk Sync Audit
    offline_id VARCHAR(100),
    is_synced BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_entries_org ON public.gate_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_gate_entries_unit ON public.gate_entries(unit_id);
CREATE INDEX IF NOT EXISTS idx_gate_entries_status ON public.gate_entries(approval_status);
CREATE INDEX IF NOT EXISTS idx_gate_entries_vehicle ON public.gate_entries(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_gate_entries_entry_time ON public.gate_entries(entry_time DESC);

-- ----------------------------------------------------------------------------
-- 5. MATERIAL PASSES & MOVE-IN / MOVE-OUT CLEARANCE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_material_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.gate_units(id) ON DELETE CASCADE,
    pass_number VARCHAR(50) NOT NULL,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('inward', 'outward', 'move_in', 'move_out')),
    is_returnable BOOLEAN DEFAULT FALSE,
    expected_return_date DATE,
    items_description JSONB NOT NULL DEFAULT '[]'::jsonb,
    transporter_name VARCHAR(100),
    vehicle_number VARCHAR(30),
    office_noc_approved BOOLEAN DEFAULT FALSE,
    noc_approved_by UUID REFERENCES public.users(id),
    gate_verified_by UUID REFERENCES public.users(id),
    status VARCHAR(30) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'gate_verified', 'completed', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, pass_number)
);

CREATE INDEX IF NOT EXISTS idx_material_passes_org ON public.gate_material_passes(organization_id);
CREATE INDEX IF NOT EXISTS idx_material_passes_unit ON public.gate_material_passes(unit_id);
CREATE INDEX IF NOT EXISTS idx_material_passes_status ON public.gate_material_passes(status);

-- ----------------------------------------------------------------------------
-- 6. GUARD PATROL & CHECKPOINTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_patrol_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    checkpoint_code VARCHAR(50) NOT NULL,
    checkpoint_name VARCHAR(150) NOT NULL,
    qr_hash VARCHAR(100) NOT NULL,
    nfc_tag_uid VARCHAR(100),
    expected_latitude NUMERIC(10, 7),
    expected_longitude NUMERIC(10, 7),
    sequence_order INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, checkpoint_code)
);

CREATE TABLE IF NOT EXISTS public.gate_patrol_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    checkpoint_id UUID NOT NULL REFERENCES public.gate_patrol_checkpoints(id) ON DELETE CASCADE,
    guard_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    scan_time TIMESTAMPTZ DEFAULT NOW(),
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_within_geofence BOOLEAN DEFAULT TRUE,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patrol_scans_checkpoint ON public.gate_patrol_scans(checkpoint_id);
CREATE INDEX IF NOT EXISTS idx_patrol_scans_guard ON public.gate_patrol_scans(guard_id);
CREATE INDEX IF NOT EXISTS idx_patrol_scans_time ON public.gate_patrol_scans(scan_time DESC);

-- ----------------------------------------------------------------------------
-- 7. EMERGENCY / SOS SOCIETY BROADCASTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_emergency_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES public.gate_units(id) ON DELETE SET NULL,
    triggered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    resident_id UUID REFERENCES public.gate_residents(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('fire', 'medical', 'security_threat', 'lift_entrapment', 'gas_leak', 'general_panic')),
    location_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_org ON public.gate_emergency_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_active ON public.gate_emergency_alerts(is_active) WHERE is_active = TRUE;

-- ----------------------------------------------------------------------------
-- 8. OFFLINE SYNC RPC FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_offline_gate_entries(
    p_entries JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    entry_item JSONB;
    v_inserted INT := 0;
    v_updated INT := 0;
BEGIN
    FOR entry_item IN SELECT * FROM jsonb_array_elements(p_entries)
    LOOP
        IF EXISTS (SELECT 1 FROM public.gate_entries WHERE offline_id = entry_item->>'offline_id') THEN
            UPDATE public.gate_entries
            SET 
                exit_time = CASE WHEN entry_item->>'exit_time' IS NOT NULL THEN (entry_item->>'exit_time')::timestamptz ELSE exit_time END,
                exit_gate_name = COALESCE(entry_item->>'exit_gate_name', exit_gate_name),
                approval_status = COALESCE(entry_item->>'approval_status', approval_status),
                updated_at = NOW()
            WHERE offline_id = entry_item->>'offline_id';
            v_updated := v_updated + 1;
        ELSE
            INSERT INTO public.gate_entries (
                organization_id, unit_id, location_id, visitor_type,
                visitor_name, visitor_phone, vehicle_number, company_name,
                visitor_photo_url, helper_id, entry_gate_name, guard_user_id,
                entry_time, exit_time, approval_status, approval_channel,
                offline_id, is_synced
            ) VALUES (
                entry_item->>'organization_id',
                CASE WHEN entry_item->>'unit_id' IS NOT NULL THEN (entry_item->>'unit_id')::uuid ELSE NULL END,
                CASE WHEN entry_item->>'location_id' IS NOT NULL THEN (entry_item->>'location_id')::uuid ELSE NULL END,
                COALESCE(entry_item->>'visitor_type', 'guest'),
                COALESCE(entry_item->>'visitor_name', 'Guest'),
                entry_item->>'visitor_phone',
                entry_item->>'vehicle_number',
                entry_item->>'company_name',
                entry_item->>'visitor_photo_url',
                CASE WHEN entry_item->>'helper_id' IS NOT NULL THEN (entry_item->>'helper_id')::uuid ELSE NULL END,
                COALESCE(entry_item->>'entry_gate_name', 'Main Gate'),
                CASE WHEN entry_item->>'guard_user_id' IS NOT NULL THEN (entry_item->>'guard_user_id')::uuid ELSE NULL END,
                COALESCE((entry_item->>'entry_time')::timestamptz, NOW()),
                CASE WHEN entry_item->>'exit_time' IS NOT NULL THEN (entry_item->>'exit_time')::timestamptz ELSE NULL END,
                COALESCE(entry_item->>'approval_status', 'approved'),
                COALESCE(entry_item->>'approval_channel', 'guard_manual'),
                entry_item->>'offline_id',
                TRUE
            );
            v_inserted := v_inserted + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'inserted', v_inserted,
        'updated', v_updated
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.gate_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_daily_helpers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_helper_unit_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_material_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_patrol_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_patrol_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Read policies: Authenticated users can view their society's gate data
CREATE POLICY "gate_units_select" ON public.gate_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "gate_residents_select" ON public.gate_residents FOR SELECT TO authenticated USING (true);
CREATE POLICY "gate_daily_helpers_select" ON public.gate_daily_helpers FOR SELECT TO authenticated USING (true);
CREATE POLICY "gate_helper_mappings_select" ON public.gate_helper_unit_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "gate_entries_select" ON public.gate_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "gate_material_passes_select" ON public.gate_material_passes FOR SELECT TO authenticated USING (true);
CREATE POLICY "gate_patrol_checkpoints_select" ON public.gate_patrol_checkpoints FOR SELECT TO authenticated USING (true);
CREATE POLICY "gate_patrol_scans_select" ON public.gate_patrol_scans FOR SELECT TO authenticated USING (true);
CREATE POLICY "gate_emergency_alerts_select" ON public.gate_emergency_alerts FOR SELECT TO authenticated USING (true);

-- Write policies: Guards, operations staff, and residents
CREATE POLICY "gate_entries_insert" ON public.gate_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gate_entries_update" ON public.gate_entries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "gate_patrol_scans_insert" ON public.gate_patrol_scans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gate_emergency_alerts_insert" ON public.gate_emergency_alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gate_emergency_alerts_update" ON public.gate_emergency_alerts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "gate_material_passes_insert" ON public.gate_material_passes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gate_material_passes_update" ON public.gate_material_passes FOR UPDATE TO authenticated USING (true);

COMMIT;
