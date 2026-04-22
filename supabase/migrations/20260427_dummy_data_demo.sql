-- ============================================================================
-- CRM & Operations: Dummy Data for Demo (Phase 4.2)
-- Description: Sets up a hierarchical team and sample leads to test workflows.
-- ============================================================================

DO $$
DECLARE
    v_org_id TEXT;
    v_manager_id UUID := '00000000-0000-0000-0000-000000000001';
    v_bd1_id UUID := '84d4ee16-b60f-401c-9478-584b7cbea26d'; -- Nakul's specific ID
    v_bd2_id UUID := '00000000-0000-0000-0000-000000000003';
    v_lead1_id UUID := '11111111-1111-1111-1111-111111111111';
    v_lead2_id UUID := '22222222-2222-2222-2222-222222222222';
    v_lead3_id UUID := '33333333-3333-3333-3333-333333333333';
    v_lead_pramuk_id UUID := '44444444-4444-4444-4444-444444444444';
    v_template_id UUID := '55555555-5555-5555-5555-555555555555';
    v_quotation_id UUID := '66666666-6666-6666-6666-666666666666';
BEGIN
    -- 1. Get a valid Organization ID
    SELECT id INTO v_org_id FROM organizations LIMIT 1;
    
    IF v_org_id IS NULL THEN
        -- Create a dummy organization if none exists
        v_org_id := 'DEMO_ORG_ID';
        INSERT INTO organizations (id, short_name, full_name) 
        VALUES (v_org_id, 'DEMO_ORG', 'Paradigm Demo Organization')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 2. Ensure Roles exist
    INSERT INTO public.roles (id, display_name, permissions)
    VALUES ('business_developer', 'Business Developer', '{view_crm, view_profile, view_own_attendance, apply_for_leave}')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Cleanup existing dummy data to allow re-run
    DELETE FROM crm_quotations WHERE id = v_quotation_id;
    DELETE FROM crm_checklist_submissions WHERE lead_id IN (v_lead1_id, v_lead2_id, v_lead3_id, v_lead_pramuk_id);
    DELETE FROM crm_checklist_templates WHERE id = v_template_id;
    DELETE FROM crm_followups WHERE lead_id IN (v_lead1_id, v_lead2_id, v_lead3_id, v_lead_pramuk_id);
    DELETE FROM crm_leads WHERE id IN (v_lead1_id, v_lead2_id, v_lead3_id, v_lead_pramuk_id);

    -- 4. Create/Sync Users
    -- Demo Manager
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_manager_id) THEN
        INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
        VALUES (v_manager_id, 'manager@demo.com', '{"name":"Demo Manager"}', 'authenticated', 'authenticated', now());
    END IF;

    INSERT INTO public.users (id, name, email, role_id, organization_id)
    VALUES (v_manager_id, 'Demo Manager', 'manager@demo.com', 'admin', v_org_id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

    -- Nakul (BD)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'nakulalvar@paradigmfms.com') THEN
        INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
        VALUES (v_bd1_id, 'nakulalvar@paradigmfms.com', '{"name":"Nakul R Alvar"}', 'authenticated', 'authenticated', now());
    ELSE
        SELECT id INTO v_bd1_id FROM auth.users WHERE email = 'nakulalvar@paradigmfms.com' LIMIT 1;
    END IF;

    INSERT INTO public.users (id, name, email, role_id, organization_id, reporting_manager_id)
    VALUES (v_bd1_id, 'Nakul R Alvar', 'nakulalvar@paradigmfms.com', 'business_developer', v_org_id, v_manager_id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, reporting_manager_id = EXCLUDED.reporting_manager_id;

    -- Vinod (BD)
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'services@southwallsecurity.com') THEN
        INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, email_confirmed_at)
        VALUES (v_bd2_id, 'services@southwallsecurity.com', '{"name":"Vinod Menon"}', 'authenticated', 'authenticated', now());
    ELSE
        SELECT id INTO v_bd2_id FROM auth.users WHERE email = 'services@southwallsecurity.com' LIMIT 1;
    END IF;

    INSERT INTO public.users (id, name, email, role_id, organization_id, reporting_manager_id)
    VALUES (v_bd2_id, 'Vinod Menon', 'services@southwallsecurity.com', 'business_developer', v_org_id, v_manager_id)
    ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id, reporting_manager_id = EXCLUDED.reporting_manager_id;

    -- 5. Insert Leads
    INSERT INTO crm_leads (id, client_name, association_name, property_type, city, status, created_by, organization_id)
    VALUES (v_lead1_id, 'Sunrise Apartments', 'Sunrise HOA', 'Residential', 'Bengaluru', 'New Lead', v_bd1_id, v_org_id);

    INSERT INTO crm_leads (id, client_name, association_name, property_type, city, status, created_by, organization_id)
    VALUES (v_lead2_id, 'Tech Park Plaza', 'Global Tech Assoc', 'Commercial', 'Hyderabad', 'Contacted', v_bd2_id, v_org_id);

    INSERT INTO crm_leads (id, client_name, association_name, property_type, city, status, created_by, assigned_to, organization_id)
    VALUES (v_lead3_id, 'Green Valley Society', 'Green Valley Residents', 'Residential', 'Pune', 'Site Visit Planned', v_manager_id, v_bd1_id, v_org_id);

    -- Lead: Pramuk M M Meridian
    INSERT INTO crm_leads (
        id, client_name, association_name, contact_person, phone, email, 
        source, property_type, city, location, unit_count, area_sqft, 
        tower_count, floor_count, notes, status, created_by, organization_id
    ) VALUES (
        v_lead_pramuk_id, 'Manu Srivatsa', 'Pramuk M M Meridian', 'Manu Srivatsa', '7899351888', 'to be collected',
        'Referral', 'Residential', 'Bengaluru', 'MM Industries Rd, Jayanagar, Bengaluru',
        189, 130680, 2, 25, '3 and 4 BHK. Lead generated by Pradeep Sir.',
        'Negotiation', v_bd1_id, v_org_id
    );

    -- 6. Add Follow-ups
    INSERT INTO crm_followups (lead_id, type, notes, outcome, created_by, created_at)
    VALUES (v_lead1_id, 'Call', 'Initial introductory call with Secretary.', 'Interested, asked for site visit.', v_bd1_id, now());

    INSERT INTO crm_followups (lead_id, type, notes, outcome, created_by, created_at)
    VALUES (v_lead_pramuk_id, 'Site Visit', 'Visit the site and meet with the client.', 'they have asked to provided proposal', v_bd1_id, now() - interval '2 days');

    INSERT INTO crm_followups (lead_id, type, notes, outcome, created_by, created_at)
    VALUES (v_lead_pramuk_id, 'Call', 'The President requested cost reduction.', 'Revised proposal sent.', v_bd1_id, now() - interval '1 day');

    -- 7. Checklist Template
    INSERT INTO crm_checklist_templates (id, name, description, sections, created_by)
    VALUES (v_template_id, 'Standard Site Survey', 'Basic infrastructure assessment', 
    '[{"id":"sec_1","name":"General","fields":[{"id":"f1","label":"Towers","type":"number","required":true}]}]'::jsonb, v_manager_id);

    -- 8. Quotation
    INSERT INTO crm_quotations (id, lead_id, quotation_number, status, monthly_cost, annual_cost, margin_percent, manpower_details, created_by)
    VALUES (v_quotation_id, v_lead1_id, 'QTN-2026-001', 'Pending Approval', 450000, 5400000, 15.5,
    '[{"role": "Security Guard", "count": 10, "salary": 18000, "shift": "12hr"}]'::jsonb, v_bd1_id);

    RAISE NOTICE 'CRM Interactive Demo data populated successfully linked to org: %', v_org_id;
END $$;
