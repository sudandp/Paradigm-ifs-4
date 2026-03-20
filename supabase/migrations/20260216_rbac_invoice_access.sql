-- Migration: RBAC for Site Invoice Tracker and Defaults
-- Date: 2026-02-16
-- Description: Implements strict RBAC for site_invoice_tracker and site_invoice_defaults.

-- 1. Add created_by to site_invoice_defaults if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'created_by') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_invoice_defaults' AND column_name = 'created_by_name') THEN
        ALTER TABLE site_invoice_defaults ADD COLUMN created_by_name TEXT;
    END IF;
END $$;

-- 2. Update SITE_INVOICE_TRACKER policy
DROP POLICY IF EXISTS "Allow authenticated full access to site_invoice_tracker" ON public.site_invoice_tracker;
DROP POLICY IF EXISTS "site_invoice_tracker_rbac_policy" ON public.site_invoice_tracker;

CREATE POLICY "site_invoice_tracker_rbac_policy" ON public.site_invoice_tracker 
FOR ALL USING (
    public.check_is_admin() 
    OR created_by = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = public.site_invoice_tracker.created_by 
        AND reporting_manager_id = (select auth.uid())
    )
);

-- 3. Update SITE_INVOICE_DEFAULTS policy
DROP POLICY IF EXISTS "Allow authenticated full access to site_invoice_defaults" ON public.site_invoice_defaults;
DROP POLICY IF EXISTS "site_invoice_defaults_rbac_policy" ON public.site_invoice_defaults;

CREATE POLICY "site_invoice_defaults_rbac_policy" ON public.site_invoice_defaults 
FOR ALL USING (
    public.check_is_admin() 
    OR created_by = (select auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = public.site_invoice_defaults.created_by 
        AND reporting_manager_id = (select auth.uid())
    )
    OR created_by IS NULL -- Allow seeing system defaults if any
);
