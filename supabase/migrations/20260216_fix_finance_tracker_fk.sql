-- Fix Foreign Key on site_finance_tracker
-- Description: Changes created_by to reference public.users instead of auth.users
-- This allows fetching profile data (reporting managers) via the foreign key.

DO $$
DECLARE
    _constraint_exists boolean;
BEGIN
    -- 1. Drop existing constraint if it exists (referencing auth.users)
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'site_finance_tracker_created_by_fkey'
        AND table_name = 'site_finance_tracker'
    ) INTO _constraint_exists;

    IF _constraint_exists THEN
        ALTER TABLE public.site_finance_tracker DROP CONSTRAINT site_finance_tracker_created_by_fkey;
    END IF;

    -- 2. Add new constraint referencing public.users
    -- This ensures we can join with public.users to get reporting_manager_id
    ALTER TABLE public.site_finance_tracker
    ADD CONSTRAINT site_finance_tracker_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.users(id)
    ON DELETE SET NULL;

END $$;
