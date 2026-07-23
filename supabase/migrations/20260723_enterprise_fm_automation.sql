-- ============================================================================
-- Enterprise FM Automation Migration
-- Created: 2026-07-23
-- Description: Inventory Management, Material Consumption on Work Orders,
--              and Automatic Task Generation from Approved Quotations
-- ============================================================================

-- 1. Inventory Items Master
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id TEXT REFERENCES public.organizations(id) ON DELETE SET NULL,
    entity_id TEXT REFERENCES public.entities(id) ON DELETE CASCADE,
    
    item_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'Electrical', 'Plumbing', 'HVAC', 'Cleaning', 'Civil', 'Security', 'General'
    )),
    unit_of_measure TEXT DEFAULT 'Pcs',
    unit_cost NUMERIC(12, 2) DEFAULT 0,
    unit_selling_price NUMERIC(12, 2) DEFAULT 0,
    current_stock NUMERIC NOT NULL DEFAULT 0,
    min_reorder_level NUMERIC DEFAULT 10,
    location TEXT,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Work Order / Ticket Material Consumption
CREATE TABLE IF NOT EXISTS public.ops_ticket_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.ops_tickets(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    
    quantity_used NUMERIC NOT NULL CHECK (quantity_used > 0),
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    
    remarks TEXT,
    issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_entity ON public.inventory_items(entity_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_ops_ticket_materials_ticket ON public.ops_ticket_materials(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ops_ticket_materials_item ON public.ops_ticket_materials(item_id);

-- 4. Enable Row Level Security
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_ticket_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inventory_items_select" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_insert" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_update" ON public.inventory_items;
DROP POLICY IF EXISTS "inventory_items_delete" ON public.inventory_items;

CREATE POLICY "inventory_items_select" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_items_insert" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inventory_items_update" ON public.inventory_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "inventory_items_delete" ON public.inventory_items FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "ops_ticket_materials_select" ON public.ops_ticket_materials;
DROP POLICY IF EXISTS "ops_ticket_materials_insert" ON public.ops_ticket_materials;
DROP POLICY IF EXISTS "ops_ticket_materials_delete" ON public.ops_ticket_materials;

CREATE POLICY "ops_ticket_materials_select" ON public.ops_ticket_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "ops_ticket_materials_insert" ON public.ops_ticket_materials FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ops_ticket_materials_delete" ON public.ops_ticket_materials FOR DELETE TO authenticated USING (true);

-- 5. Trigger: Auto-Deduct Inventory Stock on Material Issue
CREATE OR REPLACE FUNCTION deduct_inventory_stock_on_material_issue()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.inventory_items
    SET current_stock = GREATEST(0, current_stock - NEW.quantity_used),
        updated_at = NOW()
    WHERE id = NEW.item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_deduct_inventory_stock') THEN
        CREATE TRIGGER trg_deduct_inventory_stock
            AFTER INSERT ON public.ops_ticket_materials
            FOR EACH ROW EXECUTE FUNCTION deduct_inventory_stock_on_material_issue();
    END IF;
END $$;

-- 6. Trigger: Automatic Task & Maintenance Generation on Quote Approval
CREATE OR REPLACE FUNCTION generate_tasks_on_quote_approval()
RETURNS TRIGGER AS $$
DECLARE
    detail JSONB;
    v_entity_id TEXT;
    v_org_id TEXT;
    v_lead_client TEXT;
    v_role_name TEXT;
    v_role_count INTEGER;
BEGIN
    -- Only run when status changes to 'Approved' or 'Accepted'
    IF (NEW.status IN ('Approved', 'Accepted') AND (OLD.status IS NULL OR OLD.status NOT IN ('Approved', 'Accepted'))) THEN
        -- Resolve Entity / Org from Lead
        SELECT converted_entity_id, organization_id, client_name 
        INTO v_entity_id, v_org_id, v_lead_client
        FROM public.crm_leads 
        WHERE id = NEW.lead_id;
        
        IF v_entity_id IS NOT NULL AND NEW.manpower_details IS NOT NULL THEN
            FOR detail IN SELECT * FROM jsonb_array_elements(NEW.manpower_details)
            LOOP
                v_role_name := COALESCE(detail->>'role', detail->>'designation', 'Site Staff');
                v_role_count := COALESCE((detail->>'count')::INTEGER, 1);
                
                -- Create Maintenance Schedule entry
                INSERT INTO public.ops_maintenance_schedules (
                    organization_id,
                    entity_id,
                    task_name,
                    description,
                    category,
                    frequency,
                    next_due_date,
                    status,
                    assigned_role
                ) VALUES (
                    v_org_id,
                    v_entity_id,
                    'Daily Operational Task: ' || v_role_name || ' (Qty: ' || v_role_count || ')',
                    'Auto-generated operational task from Approved Quotation ' || COALESCE(NEW.quotation_number, 'QTN-AUTO'),
                    'General',
                    'Daily',
                    CURRENT_DATE,
                    'Active',
                    v_role_name
                );
                
                -- Create immediate Operational Task entry
                INSERT INTO public.tasks (
                    name,
                    description,
                    priority,
                    status,
                    due_date,
                    created_by_id
                ) VALUES (
                    'Property Onboarding Task: Deploy ' || v_role_name || ' (' || v_role_count || ' staff)',
                    'Auto-generated from Approved Quotation ' || COALESCE(NEW.quotation_number, 'QTN-AUTO') || ' for client ' || COALESCE(v_lead_client, 'Site'),
                    'High',
                    'To Do',
                    CURRENT_DATE + INTERVAL '1 day',
                    NEW.created_by
                );
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_generate_tasks_on_quote_approval') THEN
        CREATE TRIGGER trg_generate_tasks_on_quote_approval
            AFTER UPDATE ON public.crm_quotations
            FOR EACH ROW EXECUTE FUNCTION generate_tasks_on_quote_approval();
    END IF;
END $$;
