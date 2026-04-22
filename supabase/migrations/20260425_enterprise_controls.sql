-- ============================================================================
-- Enterprise Controls Module: Database Schema (Phase 4)
-- Description: System Audit Trail and Multi-Stage Approval Engine
-- ============================================================================

-- 1. System Audit Logs
CREATE TABLE IF NOT EXISTS system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    module_name TEXT NOT NULL, -- e.g., 'CRM', 'Operations', 'Finance'
    table_name TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    
    record_id UUID NOT NULL, -- The UUID of the record being modified
    
    old_data JSONB,
    new_data JSONB,
    
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast searching
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON system_audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON system_audit_logs(module_name);

-- 2. Audit Trail Trigger Function
CREATE OR REPLACE FUNCTION log_system_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_module_name TEXT;
BEGIN
    -- Extract user_id from the new or old record if it exists (assuming tracking columns like updated_by or created_by)
    -- In Supabase, we can also try to get the auth.uid() if called from client
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    -- Determine module name based on table
    IF TG_TABLE_NAME LIKE 'crm_%' THEN v_module_name := 'CRM';
    ELSIF TG_TABLE_NAME LIKE 'ops_payment%' THEN v_module_name := 'Finance';
    ELSIF TG_TABLE_NAME LIKE 'ops_%' THEN v_module_name := 'Operations';
    ELSE v_module_name := 'System';
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO system_audit_logs (user_id, module_name, table_name, action_type, record_id, new_data)
        VALUES (v_user_id, v_module_name, TG_TABLE_NAME, 'INSERT', NEW.id, row_to_json(NEW)::jsonb);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if data actually changed
        IF row_to_json(OLD)::jsonb != row_to_json(NEW)::jsonb THEN
            INSERT INTO system_audit_logs (user_id, module_name, table_name, action_type, record_id, old_data, new_data)
            VALUES (v_user_id, v_module_name, TG_TABLE_NAME, 'UPDATE', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO system_audit_logs (user_id, module_name, table_name, action_type, record_id, old_data)
        VALUES (v_user_id, v_module_name, TG_TABLE_NAME, 'DELETE', OLD.id, row_to_json(OLD)::jsonb);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach Triggers to Key Tables (Check if they exist first)
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_leads') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_crm_leads') THEN
            CREATE TRIGGER trg_audit_crm_leads AFTER INSERT OR UPDATE OR DELETE ON crm_leads
                FOR EACH ROW EXECUTE FUNCTION log_system_audit();
        END IF;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ops_tickets') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_ops_tickets') THEN
            CREATE TRIGGER trg_audit_ops_tickets AFTER INSERT OR UPDATE OR DELETE ON ops_tickets
                FOR EACH ROW EXECUTE FUNCTION log_system_audit();
        END IF;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ops_contracts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_ops_contracts') THEN
            CREATE TRIGGER trg_audit_ops_contracts AFTER INSERT OR UPDATE OR DELETE ON ops_contracts
                FOR EACH ROW EXECUTE FUNCTION log_system_audit();
        END IF;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ops_payment_receipts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_ops_payments') THEN
            CREATE TRIGGER trg_audit_ops_payments AFTER INSERT OR UPDATE OR DELETE ON ops_payment_receipts
                FOR EACH ROW EXECUTE FUNCTION log_system_audit();
        END IF;
    END IF;
END $$;


-- 4. Multi-Stage Approval Requests
CREATE TABLE IF NOT EXISTS ops_approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    
    module_name TEXT NOT NULL, -- e.g., 'Quotation', 'Contract'
    record_id UUID NOT NULL, -- ID of the Quotation or Contract
    title TEXT NOT NULL,
    
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Workflow Stage
    approval_stage INTEGER DEFAULT 1,
    required_role TEXT NOT NULL, -- The role required to approve the current stage
    
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    
    approver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    comments TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_approvals_status ON ops_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_ops_approvals_role ON ops_approval_requests(required_role);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE system_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON system_audit_logs FOR SELECT TO authenticated USING (true);
-- Application should not insert/update/delete audit logs directly, only triggers.
-- But since trigger runs as SECURITY DEFINER, it bypasses RLS for inserts.

CREATE POLICY "approvals_select" ON ops_approval_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "approvals_insert" ON ops_approval_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "approvals_update" ON ops_approval_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "approvals_delete" ON ops_approval_requests FOR DELETE TO authenticated USING (true);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ops_approvals_updated_at') THEN
        CREATE TRIGGER trg_ops_approvals_updated_at BEFORE UPDATE ON ops_approval_requests
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
