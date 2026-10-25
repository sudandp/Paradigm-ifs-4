-- ============================================================================
-- Phase 2: Asset Planned Preventive Maintenance (PPM) & Equipment Register
-- Paradigm Office 4 Facility OS (Enterprise Parity)
-- ============================================================================

-- 1. Create ops_assets table (Physical Site Equipment Register)
CREATE TABLE IF NOT EXISTS public.ops_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    entity_id TEXT REFERENCES public.entities(id) ON DELETE SET NULL,
    
    asset_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'STP', 
        'GENERATOR', 
        'LIFT', 
        'BOOSTER_PUMPS', 
        'WTP', 
        'ELECTRICAL_PANEL', 
        'HT_YARD', 
        'FIRE_FIGHTING'
    )),
    location TEXT NOT NULL,
    make_model TEXT,
    serial_number TEXT,
    installation_date DATE,
    capacity TEXT,
    
    amc_vendor_name TEXT,
    amc_expiry_date DATE,
    
    status TEXT NOT NULL DEFAULT 'Operational' CHECK (status IN (
        'Operational', 
        'Under Maintenance', 
        'Critical Fault', 
        'Decommissioned'
    )),
    
    qr_code_payload TEXT UNIQUE NOT NULL,
    last_inspected_at TIMESTAMPTZ,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index per site equipment code
CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_assets_code_entity 
    ON public.ops_assets (entity_id, asset_code);

CREATE INDEX IF NOT EXISTS idx_ops_assets_category ON public.ops_assets (category);
CREATE INDEX IF NOT EXISTS idx_ops_assets_qr ON public.ops_assets (qr_code_payload);

-- 2. Create ops_asset_ppm_checklists (Standardized OEM/FMS Parameter Specs)
CREATE TABLE IF NOT EXISTS public.ops_asset_ppm_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_category TEXT NOT NULL,
    checklist_name TEXT NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('Daily', 'Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Yearly')),
    parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create ops_asset_ppm_logs (Technician Physical QR Inspection Records)
CREATE TABLE IF NOT EXISTS public.ops_asset_ppm_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.ops_assets(id) ON DELETE CASCADE,
    checklist_id UUID REFERENCES public.ops_asset_ppm_checklists(id) ON DELETE SET NULL,
    
    inspected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    inspected_by_name TEXT,
    inspected_at TIMESTAMPTZ DEFAULT NOW(),
    
    qr_scanned BOOLEAN NOT NULL DEFAULT TRUE,
    parameter_readings JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    has_abnormalities BOOLEAN NOT NULL DEFAULT FALSE,
    abnormality_notes TEXT,
    photo_urls TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_asset_ppm_logs_asset ON public.ops_asset_ppm_logs (asset_id);
CREATE INDEX IF NOT EXISTS idx_ops_asset_ppm_logs_date ON public.ops_asset_ppm_logs (inspected_at DESC);

-- 4. Seed Standardized Residential Society Digital Checklists
INSERT INTO public.ops_asset_ppm_checklists (asset_category, checklist_name, frequency, parameters)
VALUES
(
    'STP',
    'Daily Sewage Treatment Plant Health Check',
    'Daily',
    '[
        {"id": "stp_ph", "label": "pH Level of Treated Water", "unit": "pH", "type": "NUMBER", "min": 6.5, "max": 8.5, "desc": "Standard permissible range 6.5 - 8.5"},
        {"id": "stp_do", "label": "Dissolved Oxygen (DO)", "unit": "mg/L", "type": "NUMBER", "min": 1.5, "max": 3.0, "desc": "Aeration tank optimal DO level"},
        {"id": "stp_chlorine", "label": "Residual Chlorine", "unit": "PPM", "type": "NUMBER", "min": 1.0, "max": 2.5, "desc": "Treated water disinfection level"},
        {"id": "stp_blower_pressure", "label": "Aeration Blower Pressure", "unit": "bar", "type": "NUMBER", "min": 0.3, "max": 0.6, "desc": "Air compressor manifold pressure"},
        {"id": "stp_clarity", "label": "Treated Water Clarity & Odor", "type": "PASS_FAIL", "desc": "Verify water is clear with zero foul odor"}
    ]'::jsonb
),
(
    'GENERATOR',
    'Weekly Diesel Generator (DG) Standby Run & Health',
    'Weekly',
    '[
        {"id": "dg_battery_volt", "label": "Battery Cranking Voltage", "unit": "V", "type": "NUMBER", "min": 12.4, "max": 13.8, "desc": "Lead-acid starter battery charge"},
        {"id": "dg_diesel_level", "label": "Diesel Day-Tank Level", "unit": "%", "type": "NUMBER", "min": 50, "max": 100, "desc": "Minimum 50% backup capacity required"},
        {"id": "dg_oil_pressure", "label": "Lube Oil Pressure (Running)", "unit": "bar", "type": "NUMBER", "min": 3.5, "max": 5.5, "desc": "Operational oil lubrication pressure"},
        {"id": "dg_coolant_temp", "label": "Coolant Operating Temperature", "unit": "°C", "type": "NUMBER", "min": 75, "max": 90, "desc": "Radiator coolant temperature"},
        {"id": "dg_run_hours", "label": "Cumulative Run Hours", "unit": "Hours", "type": "NUMBER", "desc": "Engine hour meter log"},
        {"id": "dg_amf_auto", "label": "AMF Panel Selector in AUTO Mode", "type": "PASS_FAIL", "desc": "Ensures instant automatic failover on grid loss"}
    ]'::jsonb
),
(
    'LIFT',
    'Bi-Weekly Elevator & Safety Interlock Inspection',
    'Fortnightly',
    '[
        {"id": "lift_ard", "label": "Automatic Rescue Device (ARD) Battery", "type": "PASS_FAIL", "desc": "Verify backup battery safely levels lift to nearest landing during power loss"},
        {"id": "lift_alarm_intercom", "label": "Emergency Alarm & Gate Intercom", "type": "PASS_FAIL", "desc": "Two-way audio communication to security control room"},
        {"id": "lift_door_sensor", "label": "Door Infrared Safety Curtain", "type": "PASS_FAIL", "desc": "Door must reverse immediately on obstruction"},
        {"id": "lift_cabin_fan_light", "label": "Cabin Emergency Lighting & Fan", "type": "PASS_FAIL", "desc": "Backup light must activate within 3 seconds"},
        {"id": "lift_floor_leveling", "label": "Floor Leveling Accuracy", "unit": "mm", "type": "NUMBER", "min": 0, "max": 5, "desc": "Tolerance limit maximum ±5mm"}
    ]'::jsonb
),
(
    'BOOSTER_PUMPS',
    'Daily Hydro-Pneumatic Domestic Water Pressure Check',
    'Daily',
    '[
        {"id": "pmp_delivery_pressure", "label": "Main Ring Header Pressure", "unit": "bar", "type": "NUMBER", "min": 3.5, "max": 5.5, "desc": "Constant water supply pressure to high-rise floors"},
        {"id": "pmp_suction_pressure", "label": "Suction Manifold Pressure", "unit": "bar", "type": "NUMBER", "min": 1.0, "max": 2.5, "desc": "Underground tank head pressure"},
        {"id": "pmp_current_amps", "label": "Motor Running Current", "unit": "Amps", "type": "NUMBER", "min": 8.0, "max": 18.0, "desc": "Full load current draw"},
        {"id": "pmp_auto_toggle", "label": "Duty / Standby Auto-Alternation", "type": "PASS_FAIL", "desc": "Panel alternates Lead & Lag pumps to balance wear"},
        {"id": "pmp_gland_leak", "label": "Mechanical Seal Leakage", "type": "PASS_FAIL", "desc": "Verify zero abnormal shaft leakage"}
    ]'::jsonb
)
ON CONFLICT DO NOTHING;
