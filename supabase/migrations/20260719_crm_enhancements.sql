-- Add new columns for enhanced CRM tracking
ALTER TABLE crm_leads 
ADD COLUMN IF NOT EXISTS deal_value NUMERIC,
ADD COLUMN IF NOT EXISTS competitor TEXT,
ADD COLUMN IF NOT EXISTS lost_date DATE,
ADD COLUMN IF NOT EXISTS stage_updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create a function to auto-update stage_updated_at
CREATE OR REPLACE FUNCTION update_crm_lead_stage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.stage_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_crm_leads_stage_updated_at ON crm_leads;

-- Create trigger
CREATE TRIGGER trg_crm_leads_stage_updated_at
BEFORE UPDATE ON crm_leads
FOR EACH ROW
EXECUTE FUNCTION update_crm_lead_stage_timestamp();
