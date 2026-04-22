-- ============================================================================
-- CRM Module: Database Schema
-- Created: 2026-04-22
-- Description: Lead pipeline, dynamic checklists, costing engine, and audit
-- ============================================================================

-- 1. CRM Leads
CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    
    -- Client Info
    client_name TEXT NOT NULL,
    association_name TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    source TEXT CHECK (source IN ('Referral', 'Website', 'Direct', 'Marketing', 'Facebook Ads', 'WhatsApp Campaign', 'Other')),
    
    -- Property Info
    property_type TEXT CHECK (property_type IN ('Residential', 'Commercial', 'Mixed Use')),
    city TEXT,
    location TEXT,
    area_sqft NUMERIC,
    built_up_area NUMERIC,
    super_built_up_area NUMERIC,
    tower_count INTEGER,
    floor_count INTEGER,
    unit_count INTEGER,
    
    -- Pipeline State
    status TEXT NOT NULL DEFAULT 'New Lead' CHECK (status IN (
        'New Lead', 'Contacted', 'Site Visit Planned', 'Survey Completed',
        'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Onboarding Started'
    )),
    
    -- Existing Vendors
    present_fms_company TEXT,
    present_security_agency TEXT,
    pest_control_vendor TEXT,
    other_vendors JSONB DEFAULT '[]'::jsonb,
    
    -- Assignment & Dates
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expected_start_date DATE,
    lost_reason TEXT,
    notes TEXT,
    
    -- Conversion
    converted_entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. CRM Follow-ups
CREATE TABLE IF NOT EXISTS crm_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    
    type TEXT CHECK (type IN ('Call', 'Meeting', 'Email', 'WhatsApp', 'Site Visit', 'Other')),
    notes TEXT,
    outcome TEXT,
    next_followup_date DATE,
    reminder_set BOOLEAN DEFAULT FALSE,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Dynamic Checklist Templates (Admin-defined)
CREATE TABLE IF NOT EXISTS crm_checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Dynamic structure: Array of sections, each with fields
    -- Example: [{ "name": "Infrastructure", "fields": [{ "label": "DG/Generator", "type": "yes_no", "required": true }, ...] }]
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Checklist Submissions (Survey data per lead)
CREATE TABLE IF NOT EXISTS crm_checklist_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES crm_checklist_templates(id) ON DELETE RESTRICT,
    
    -- Responses keyed by field ID
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Category-wise photo uploads: { "Infrastructure": ["url1", "url2"], "Assets": [...] }
    photo_urls JSONB DEFAULT '{}'::jsonb,
    
    -- Voice note
    voice_note_url TEXT,
    
    -- Remarks
    remarks TEXT,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed')),
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Global Statutory Masters (PF, ESI, Min Wages)
CREATE TABLE IF NOT EXISTS crm_statutory_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Rates (percentage)
    pf_rate NUMERIC DEFAULT 12.00,
    esi_employee_rate NUMERIC DEFAULT 0.75,
    esi_employer_rate NUMERIC DEFAULT 3.25,
    bonus_rate NUMERIC DEFAULT 8.33,
    gratuity_rate NUMERIC DEFAULT 4.81,
    edli_rate NUMERIC DEFAULT 0.50,
    admin_charges_rate NUMERIC DEFAULT 0.50,
    lwf_employee NUMERIC DEFAULT 0,
    lwf_employer NUMERIC DEFAULT 0,
    
    -- Applicability
    esi_wage_ceiling NUMERIC DEFAULT 21000,
    pf_wage_ceiling NUMERIC DEFAULT 15000,
    
    -- Region
    state TEXT,
    city TEXT,
    
    -- Min Wages by category (JSONB for flexibility)
    -- Example: { "Unskilled": 12000, "Semi-Skilled": 14000, "Skilled": 16000, "Highly Skilled": 18000 }
    min_wages JSONB DEFAULT '{}'::jsonb,
    
    effective_from DATE,
    effective_to DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CRM Quotations / Proposals
CREATE TABLE IF NOT EXISTS crm_quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
    
    -- Quotation Number
    quotation_number TEXT,
    version INTEGER DEFAULT 1,
    
    -- Manpower breakdown (JSONB array of role-wise details)
    -- [{ "role": "Security Guard", "count": 10, "salary": 15000, "shift": "12hr", "reliever": true }]
    manpower_details JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Cost components
    total_salary_cost NUMERIC DEFAULT 0,
    statutory_cost NUMERIC DEFAULT 0,
    consumables_cost NUMERIC DEFAULT 0,
    equipment_cost NUMERIC DEFAULT 0,
    uniform_cost NUMERIC DEFAULT 0,
    admin_charges NUMERIC DEFAULT 0,
    management_fee NUMERIC DEFAULT 0,
    management_fee_percent NUMERIC DEFAULT 0,
    gst_amount NUMERIC DEFAULT 0,
    gst_percent NUMERIC DEFAULT 18,
    
    -- Totals
    monthly_cost NUMERIC DEFAULT 0,
    annual_cost NUMERIC DEFAULT 0,
    
    -- Profitability
    margin_amount NUMERIC DEFAULT 0,
    margin_percent NUMERIC DEFAULT 0,
    
    -- Output
    pdf_url TEXT,
    
    -- Status
    status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending Approval', 'Approved', 'Sent to Client', 'Accepted', 'Rejected')),
    
    -- Approval
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    approval_remarks TEXT,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Audit Logs (Enterprise-grade)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    
    module TEXT NOT NULL,  -- 'crm', 'operations', 'finance', etc.
    record_id TEXT,        -- ID of the affected record
    action TEXT NOT NULL,  -- 'create', 'update', 'delete', 'status_change', 'login', etc.
    
    -- Change tracking
    old_value JSONB,
    new_value JSONB,
    
    -- Context
    ip_address TEXT,
    device_info TEXT,
    description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_org ON crm_leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_assigned ON crm_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_created ON crm_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_followups_lead ON crm_followups(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_followups_next ON crm_followups(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_crm_checklist_sub_lead ON crm_checklist_submissions(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotations_lead ON crm_quotations(lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON audit_logs(record_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_checklist_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_statutory_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all CRM data (RBAC enforced at app layer)
CREATE POLICY "crm_leads_select" ON crm_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_leads_insert" ON crm_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_leads_update" ON crm_leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "crm_leads_delete" ON crm_leads FOR DELETE TO authenticated USING (true);

CREATE POLICY "crm_followups_all" ON crm_followups FOR ALL TO authenticated USING (true);
CREATE POLICY "crm_templates_select" ON crm_checklist_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_templates_insert" ON crm_checklist_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_templates_update" ON crm_checklist_templates FOR UPDATE TO authenticated USING (true);

CREATE POLICY "crm_submissions_all" ON crm_checklist_submissions FOR ALL TO authenticated USING (true);
CREATE POLICY "crm_statutory_select" ON crm_statutory_masters FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_statutory_manage" ON crm_statutory_masters FOR ALL TO authenticated USING (true);
CREATE POLICY "crm_quotations_all" ON crm_quotations FOR ALL TO authenticated USING (true);
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_leads_updated_at') THEN
        CREATE TRIGGER trg_crm_leads_updated_at BEFORE UPDATE ON crm_leads
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_quotations_updated_at') THEN
        CREATE TRIGGER trg_crm_quotations_updated_at BEFORE UPDATE ON crm_quotations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_crm_submissions_updated_at') THEN
        CREATE TRIGGER trg_crm_submissions_updated_at BEFORE UPDATE ON crm_checklist_submissions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- SEED: Default Checklist Template (Property Service Takeover)
-- ============================================================================

INSERT INTO crm_checklist_templates (name, description, sections) VALUES (
    'Property Service Takeover Checklist',
    'Standard checklist for new property takeover - Infrastructure, Assets, Compliance',
    '[
        {
            "id": "infra",
            "name": "Infrastructure",
            "fields": [
                {"id": "dg_generator", "label": "DG / Generator", "type": "yes_no_remarks", "required": true},
                {"id": "stp", "label": "STP (Sewage Treatment Plant)", "type": "yes_no_remarks", "required": true},
                {"id": "wtp", "label": "WTP (Water Treatment Plant)", "type": "yes_no_remarks", "required": false},
                {"id": "pumps", "label": "Pumps", "type": "yes_no_remarks", "required": true},
                {"id": "lifts", "label": "Lifts / Elevators", "type": "yes_no_remarks", "required": true},
                {"id": "fire_systems", "label": "Fire Fighting Systems", "type": "yes_no_remarks", "required": true},
                {"id": "electrical_panels", "label": "Electrical Panels", "type": "yes_no_remarks", "required": true},
                {"id": "cctv", "label": "CCTV Systems", "type": "yes_no_remarks", "required": false},
                {"id": "intercom", "label": "Intercom System", "type": "yes_no_remarks", "required": false},
                {"id": "club_house", "label": "Club House / Amenities", "type": "yes_no_remarks", "required": false},
                {"id": "parking", "label": "Parking Area", "type": "yes_no_remarks", "required": true},
                {"id": "water_tank", "label": "Water Tank / Sump", "type": "yes_no_remarks", "required": true},
                {"id": "borewell", "label": "Borewell", "type": "yes_no_remarks", "required": false},
                {"id": "sewage_lines", "label": "Sewage Lines", "type": "yes_no_remarks", "required": true},
                {"id": "swimming_pool", "label": "Swimming Pool", "type": "yes_no_remarks", "required": false},
                {"id": "transformer", "label": "Transformer", "type": "yes_no_remarks", "required": false}
            ]
        },
        {
            "id": "assets",
            "name": "Assets Handover",
            "fields": [
                {"id": "keys_received", "label": "Keys Received", "type": "yes_no_remarks", "required": true},
                {"id": "amc_documents", "label": "AMC Documents", "type": "yes_no_remarks", "required": true},
                {"id": "warranty_docs", "label": "Warranty Documents", "type": "yes_no_remarks", "required": false},
                {"id": "drawings", "label": "Drawings / Blueprints", "type": "yes_no_remarks", "required": false},
                {"id": "vendor_contacts", "label": "Vendor Contact List", "type": "yes_no_remarks", "required": true},
                {"id": "equipment_inventory", "label": "Equipment Inventory", "type": "yes_no_remarks", "required": true}
            ]
        },
        {
            "id": "compliance",
            "name": "Compliance",
            "fields": [
                {"id": "pf_registration", "label": "PF Registration", "type": "yes_no_remarks", "required": true},
                {"id": "esi_registration", "label": "ESI Registration", "type": "yes_no_remarks", "required": true},
                {"id": "labour_license", "label": "Labour License", "type": "yes_no_remarks", "required": true},
                {"id": "shop_establishment", "label": "Shop & Establishment", "type": "yes_no_remarks", "required": false},
                {"id": "fire_noc", "label": "Fire NOC", "type": "yes_no_remarks", "required": true},
                {"id": "lift_license", "label": "Lift License", "type": "yes_no_remarks", "required": false},
                {"id": "pollution_stp_docs", "label": "Pollution / STP Documentation", "type": "yes_no_remarks", "required": false},
                {"id": "contract_labour", "label": "Contract Labour Compliance", "type": "yes_no_remarks", "required": true}
            ]
        },
        {
            "id": "site_conditions",
            "name": "Site Conditions",
            "fields": [
                {"id": "overall_condition", "label": "Overall Site Condition", "type": "rating_1_5", "required": true},
                {"id": "cleanliness", "label": "Cleanliness Standard", "type": "rating_1_5", "required": true},
                {"id": "security_posture", "label": "Security Posture", "type": "rating_1_5", "required": true},
                {"id": "landscape_condition", "label": "Landscaping Condition", "type": "rating_1_5", "required": false},
                {"id": "special_observations", "label": "Special Observations", "type": "text", "required": false}
            ]
        }
    ]'::jsonb
) ON CONFLICT DO NOTHING;
