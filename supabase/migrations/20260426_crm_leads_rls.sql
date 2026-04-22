-- ============================================================================
-- CRM Module: Business Developer Hierarchical RLS (Phase 4.1)
-- Description: Enforces strict data isolation so Business Developers only 
-- see their own/assigned leads, and Managers see their team's leads.
-- ============================================================================

DO $$ BEGIN
    
    -- Check if the table actually exists first before modifying policies
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crm_leads') THEN

        -- 1. Drop the existing permissive policies created in the original CRM module
        IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_leads' AND policyname = 'crm_leads_select') THEN
            DROP POLICY "crm_leads_select" ON crm_leads;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_leads' AND policyname = 'crm_leads_update') THEN
            DROP POLICY "crm_leads_update" ON crm_leads;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_leads' AND policyname = 'crm_leads_delete') THEN
            DROP POLICY "crm_leads_delete" ON crm_leads;
        END IF;

        -- 2. Create the New SELECT Policy (Hierarchical Visibility)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_leads' AND policyname = 'crm_leads_hierarchical_select') THEN
            CREATE POLICY "crm_leads_hierarchical_select" ON crm_leads FOR SELECT TO authenticated USING (
                created_by = auth.uid() OR
                assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users u 
                    WHERE u.id = crm_leads.created_by 
                    AND (
                        u.reporting_manager_id = auth.uid() OR 
                        u.reporting_manager_2_id = auth.uid() OR 
                        u.reporting_manager_3_id = auth.uid()
                    )
                ) OR
                EXISTS (
                    SELECT 1 FROM public.users u 
                    WHERE u.id = auth.uid() AND (u.role_id IN ('super_admin', 'admin', 'director') OR public.check_is_admin())
                )
            );
        END IF;

        -- 3. Create the New UPDATE Policy
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_leads' AND policyname = 'crm_leads_hierarchical_update') THEN
            CREATE POLICY "crm_leads_hierarchical_update" ON crm_leads FOR UPDATE TO authenticated USING (
                created_by = auth.uid() OR
                assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users u 
                    WHERE u.id = crm_leads.created_by 
                    AND (
                        u.reporting_manager_id = auth.uid() OR 
                        u.reporting_manager_2_id = auth.uid() OR 
                        u.reporting_manager_3_id = auth.uid()
                    )
                ) OR
                EXISTS (
                    SELECT 1 FROM public.users u 
                    WHERE u.id = auth.uid() AND (u.role_id IN ('super_admin', 'admin', 'director') OR public.check_is_admin())
                )
            );
        END IF;

        -- 4. Create the New DELETE Policy
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'crm_leads' AND policyname = 'crm_leads_hierarchical_delete') THEN
            CREATE POLICY "crm_leads_hierarchical_delete" ON crm_leads FOR DELETE TO authenticated USING (
                created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.users u 
                    WHERE u.id = auth.uid() AND (u.role_id IN ('super_admin', 'admin', 'director') OR public.check_is_admin())
                )
            );
        END IF;

    END IF;

END $$;
