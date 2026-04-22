-- ============================================================================
-- CRM & Sales: Full End-to-End Demo Data
-- Description: Comprehensive dataset including Leads, Checklists, Submissions, 
--              Follow-ups, and Quotations for testing the full lifecycle.
-- ============================================================================

DO $$
DECLARE
    v_org_id TEXT;
    v_manager_id UUID := '00000000-0000-0000-0000-000000000001';
    v_bd_nakul_id UUID := '84d4ee16-b60f-401c-9478-584b7cbea26d';
    v_bd_vinod_id UUID := '00000000-0000-0000-0000-000000000003';
    
    -- Lead IDs
    v_lead_skyline_id UUID := 'a1111111-1111-1111-1111-111111111111';
    v_lead_pramuk_id UUID := 'b2222222-2222-2222-2222-222222222222';
    v_lead_techpark_id UUID := 'c3333333-3333-3333-3333-333333333333';
    v_lead_greenfield_id UUID := 'd4444444-4444-4444-4444-444444444444';
    
    -- Template & Submission IDs
    v_template_survey_id UUID := 'e5555555-5555-5555-5555-555555555555';
    v_submission_skyline_id UUID := 'f6666666-6666-6666-6666-666666666666';
    
    -- Quotation ID
    v_qtn_skyline_id UUID := '77777777-7777-7777-7777-777777777777';

BEGIN
    -- 1. Get Organization context
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;
    IF v_org_id IS NULL THEN v_org_id := 'DEMO_ORG_ID'; END IF;

    -- 2. Cleanup existing Demo Data
    DELETE FROM crm_quotations WHERE id = v_qtn_skyline_id;
    DELETE FROM crm_checklist_submissions WHERE id = v_submission_skyline_id OR lead_id IN (v_lead_skyline_id, v_lead_pramuk_id, v_lead_techpark_id, v_lead_greenfield_id);
    DELETE FROM crm_checklist_templates WHERE id = v_template_survey_id;
    DELETE FROM crm_followups WHERE lead_id IN (v_lead_skyline_id, v_lead_pramuk_id, v_lead_techpark_id, v_lead_greenfield_id);
    DELETE FROM crm_leads WHERE id IN (v_lead_skyline_id, v_lead_pramuk_id, v_lead_techpark_id, v_lead_greenfield_id);

    -- 3. Ensure Users exist (Nakul and Vinod as BDs)
    -- Nakul
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_bd_nakul_id) THEN
        INSERT INTO auth.users (id, email, aud, role, email_confirmed_at)
        VALUES (v_bd_nakul_id, 'nakulalvar@paradigmfms.com', 'authenticated', 'authenticated', now());
    END IF;
    INSERT INTO public.users (id, name, email, role_id, organization_id)
    VALUES (v_bd_nakul_id, 'Nakul R Alvar', 'nakulalvar@paradigmfms.com', 'business_developer', v_org_id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

    -- Vinod
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_bd_vinod_id) THEN
        INSERT INTO auth.users (id, email, aud, role, email_confirmed_at)
        VALUES (v_bd_vinod_id, 'services@southwallsecurity.com', 'authenticated', 'authenticated', now());
    END IF;
    INSERT INTO public.users (id, name, email, role_id, organization_id)
    VALUES (v_bd_vinod_id, 'Vinod Menon', 'services@southwallsecurity.com', 'business_developer', v_org_id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

    -- 4. Create a Robust Site Survey Template
    INSERT INTO crm_checklist_templates (id, name, description, sections, created_by)
    VALUES (v_template_survey_id, 'Premium Site Audit', 'Comprehensive audit for Facilities & Security', 
    '[
        {
            "id": "sec_infra",
            "name": "Infrastructure Details",
            "fields": [
                {"id": "f_towers", "label": "Number of Towers", "type": "number", "required": true},
                {"id": "f_lifts", "label": "Number of Lifts", "type": "number", "required": true},
                {"id": "f_clubhouse", "label": "Clubhouse Area (Sqft)", "type": "number", "required": false}
            ]
        },
        {
            "id": "sec_security",
            "name": "Security Postings",
            "fields": [
                {"id": "f_gates", "label": "Main Gates Count", "type": "number", "required": true},
                {"id": "f_guards", "label": "Current Guard Strength", "type": "number", "required": true},
                {"id": "f_cctv", "label": "CCTV Coverage %", "type": "number", "required": false}
            ]
        }
    ]'::jsonb, v_manager_id);

    -- 5. Insert Diverse Leads (Pipeline Stages)
    -- Stage: New Lead
    INSERT INTO crm_leads (id, client_name, association_name, contact_person, phone, property_type, city, status, created_by, organization_id)
    VALUES (v_lead_techpark_id, 'Brigade Tech Gardens', 'BTG Management', 'Arjun Kumar', '9123456789', 'Commercial', 'Bengaluru', 'New Lead', v_bd_vinod_id, v_org_id);

    -- Stage: Contacted
    INSERT INTO crm_leads (id, client_name, association_name, contact_person, phone, property_type, city, status, created_by, organization_id)
    VALUES (v_lead_greenfield_id, 'Greenfield Villas', 'Greenfield OA', 'Sarah Smith', '9888877777', 'Residential', 'Pune', 'Contacted', v_bd_nakul_id, v_org_id);

    -- Stage: Survey Completed (Skyline Residency)
    INSERT INTO crm_leads (id, client_name, association_name, contact_person, phone, property_type, city, status, created_by, assigned_to, organization_id)
    VALUES (v_lead_skyline_id, 'Skyline Residency', 'Skyline OA', 'John Doe', '9876543210', 'Residential', 'Bengaluru', 'Survey Completed', v_bd_nakul_id, v_bd_nakul_id, v_org_id);

    -- Stage: Negotiation (Pramuk M M Meridian)
    INSERT INTO crm_leads (id, client_name, association_name, contact_person, phone, property_type, city, status, created_by, assigned_to, organization_id, unit_count, tower_count)
    VALUES (v_lead_pramuk_id, 'Manu Srivatsa', 'Pramuk M M Meridian', 'Manu Srivatsa', '7899351888', 'Residential', 'Bengaluru', 'Negotiation', v_bd_nakul_id, v_bd_nakul_id, v_org_id, 189, 2);

    -- 6. Add Detailed Follow-ups
    INSERT INTO public.crm_followups (lead_id, type, notes, outcome, created_by, created_at) VALUES
    (v_lead_skyline_id, 'Call', 'Initial pitch for FMS services.', 'Client interested in Security audit.', v_bd_nakul_id, now() - interval '5 days'),
    (v_lead_skyline_id, 'Site Visit', 'Conducted full property walk-through.', 'Audit report being prepared.', v_bd_nakul_id, now() - interval '3 days'),
    (v_lead_pramuk_id, 'Meeting', 'Discussed commercial terms with the President.', 'Requested 5% discount on AMC.', v_bd_nakul_id, now() - interval '1 day');

    -- 7. Insert a Checklist Submission (The "Filled" data)
    INSERT INTO crm_checklist_submissions (id, lead_id, template_id, data, remarks, submitted_by)
    VALUES (v_submission_skyline_id, v_lead_skyline_id, v_template_survey_id, 
    '{
        "f_towers": 4,
        "f_lifts": 12,
        "f_clubhouse": 15000,
        "f_gates": 2,
        "f_guards": 24,
        "f_cctv": 95
    }'::jsonb, 
    'The property is well-maintained but security at Gate 2 needs improvement.', 
    v_bd_nakul_id);

    -- 8. Create a Dummy Quotation
    INSERT INTO crm_quotations (id, lead_id, quotation_number, status, monthly_cost, annual_cost, margin_percent, created_by)
    VALUES (v_qtn_skyline_id, v_lead_skyline_id, 'QTN-SKY-001', 'Pending Approval', 380000, 4560000, 18.0, v_bd_nakul_id);

    RAISE NOTICE 'CRM End-to-End Demo data populated successfully.';
END $$;
