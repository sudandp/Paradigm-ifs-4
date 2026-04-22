-- ============================================================================
-- Finance Module: Database Schema (Phase 3)
-- Description: Payment Tracking, TDS Deductions, and Profitability
-- ============================================================================

-- 1. Operations Payment Receipts (Indian Standards: TDS & GST tracking)
CREATE TABLE IF NOT EXISTS ops_payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
    entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
    
    -- Invoice Details
    invoice_number TEXT NOT NULL,
    invoice_date DATE,
    invoice_base_amount NUMERIC(12, 2) DEFAULT 0,
    invoice_gst_amount NUMERIC(12, 2) DEFAULT 0,
    invoice_total_amount NUMERIC(12, 2) GENERATED ALWAYS AS (invoice_base_amount + invoice_gst_amount) STORED,
    
    -- Payment Details
    amount_received NUMERIC(12, 2) DEFAULT 0,
    payment_date DATE NOT NULL,
    payment_mode TEXT CHECK (payment_mode IN ('NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash')),
    reference_number TEXT, -- UTR or Cheque Number
    
    -- Statutory Deductions (Indian Standards)
    tds_deducted NUMERIC(12, 2) DEFAULT 0,
    tds_section TEXT, -- e.g., '194C' (Contractor), '194J' (Professional Services)
    other_deductions NUMERIC(12, 2) DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Partial', 'Full', 'Overdue')),
    remarks TEXT,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ops_payments_entity ON ops_payment_receipts(entity_id);
CREATE INDEX IF NOT EXISTS idx_ops_payments_status ON ops_payment_receipts(status);
CREATE INDEX IF NOT EXISTS idx_ops_payments_invoice ON ops_payment_receipts(invoice_number);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE ops_payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ops_payments_select" ON ops_payment_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops_payments_insert" ON ops_payment_receipts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ops_payments_update" ON ops_payment_receipts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ops_payments_delete" ON ops_payment_receipts FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ops_payments_updated_at') THEN
        CREATE TRIGGER trg_ops_payments_updated_at BEFORE UPDATE ON ops_payment_receipts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
