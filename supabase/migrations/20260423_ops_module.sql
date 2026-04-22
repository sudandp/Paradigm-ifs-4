-- ============================================================================
-- Operations Module: Database Schema (Phase 2)
-- Description: Tickets/SLA, Preventive Maintenance, and Contract Management
-- ============================================================================

-- 1. Operations Helpdesk Tickets
CREATE TABLE IF NOT EXISTS ops_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    
    -- Ticket Details
    ticket_number TEXT UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'Electrical', 'Plumbing', 'Housekeeping', 'Security', 'Civil', 'HVAC', 'General'
    )),
    
    -- Priority & SLA
    priority TEXT NOT NULL DEFAULT 'P3' CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN (
        'Open', 'In Progress', 'On Hold', 'Resolved', 'Closed'
    )),
    
    due_date TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- Assignments
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reported_by_name TEXT,
    reported_by_phone TEXT,
    
    -- Attachments (Array of URLs)
    attachments JSONB DEFAULT '[]'::jsonb,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Preventive Maintenance Schedules (PPM)
CREATE TABLE IF NOT EXISTS ops_maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    
    -- Task Details
    task_name TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN (
        'Electrical', 'Plumbing', 'Housekeeping', 'Security', 'Civil', 'HVAC', 'General'
    )),
    
    -- If tied to a specific asset tracked in Entity onboarding
    asset_reference TEXT, 
    
    -- Scheduling
    frequency TEXT NOT NULL CHECK (frequency IN (
        'Daily', 'Weekly', 'Fortnightly', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'
    )),
    last_completed_date DATE,
    next_due_date DATE,
    
    -- Status
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Discontinued')),
    
    -- Assignments
    assigned_role TEXT, -- e.g., 'Electrician', 'Housekeeping Supervisor'
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Maintenance Logs (History of PPM completions)
CREATE TABLE IF NOT EXISTS ops_maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES ops_maintenance_schedules(id) ON DELETE CASCADE,
    
    completed_date DATE NOT NULL,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    remarks TEXT,
    photo_urls JSONB DEFAULT '[]'::jsonb,
    
    status TEXT DEFAULT 'Completed' CHECK (status IN ('Completed', 'Skipped', 'Delayed')),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Contract Management
CREATE TABLE IF NOT EXISTS ops_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    
    contract_title TEXT NOT NULL,
    contract_type TEXT NOT NULL CHECK (contract_type IN (
        'Client Agreement', 'Vendor AMC', 'Lease', 'Service Level Agreement', 'Other'
    )),
    
    vendor_name TEXT, -- Applicable if contract_type is 'Vendor AMC'
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    contract_value NUMERIC DEFAULT 0,
    
    status TEXT DEFAULT 'Active' CHECK (status IN (
        'Active', 'Expiring Soon', 'Expired', 'Renewed', 'Terminated'
    )),
    
    renewal_reminder_days INTEGER DEFAULT 30,
    
    document_url TEXT,
    notes TEXT,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ops_tickets_entity ON ops_tickets(entity_id);
CREATE INDEX IF NOT EXISTS idx_ops_tickets_status ON ops_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ops_tickets_due ON ops_tickets(due_date);

CREATE INDEX IF NOT EXISTS idx_ops_maintenance_entity ON ops_maintenance_schedules(entity_id);
CREATE INDEX IF NOT EXISTS idx_ops_maintenance_next_due ON ops_maintenance_schedules(next_due_date);

CREATE INDEX IF NOT EXISTS idx_ops_contracts_entity ON ops_contracts(entity_id);
CREATE INDEX IF NOT EXISTS idx_ops_contracts_end_date ON ops_contracts(end_date);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ops_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_tickets_select" ON ops_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops_tickets_insert" ON ops_tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ops_tickets_update" ON ops_tickets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ops_tickets_delete" ON ops_tickets FOR DELETE TO authenticated USING (true);

CREATE POLICY "ops_maintenance_select" ON ops_maintenance_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops_maintenance_insert" ON ops_maintenance_schedules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ops_maintenance_update" ON ops_maintenance_schedules FOR UPDATE TO authenticated USING (true);

CREATE POLICY "ops_maintenance_logs_all" ON ops_maintenance_logs FOR ALL TO authenticated USING (true);

CREATE POLICY "ops_contracts_select" ON ops_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops_contracts_insert" ON ops_contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ops_contracts_update" ON ops_contracts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ops_contracts_delete" ON ops_contracts FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ops_tickets_updated_at') THEN
        CREATE TRIGGER trg_ops_tickets_updated_at BEFORE UPDATE ON ops_tickets
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ops_maintenance_updated_at') THEN
        CREATE TRIGGER trg_ops_maintenance_updated_at BEFORE UPDATE ON ops_maintenance_schedules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ops_contracts_updated_at') THEN
        CREATE TRIGGER trg_ops_contracts_updated_at BEFORE UPDATE ON ops_contracts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
