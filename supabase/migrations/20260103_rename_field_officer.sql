-- Migration: Rename Field Officer to Field Staff
-- Created: 2026-01-03

-- 1. Insert new role 'field_staff' into roles table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
        INSERT INTO public.roles (id, display_name)
        VALUES ('field_staff', 'Field Staff')
        ON CONFLICT (id) DO UPDATE SET display_name = 'Field Staff';
    END IF;
END $$;

-- 2. Update users table: change role_id 'field_officer' to 'field_staff'
UPDATE public.users 
SET role_id = 'field_staff' 
WHERE role_id = 'field_officer';

-- 3. Update organizations table columns
-- Rename field_officer_names -> field_staff_names
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'field_officer_names') THEN
        ALTER TABLE public.organizations RENAME COLUMN field_officer_names TO field_staff_names;
    END IF;
END $$;

-- Rename backend_field_officer_name -> backend_field_staff_name
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'backend_field_officer_name') THEN
        ALTER TABLE public.organizations RENAME COLUMN backend_field_officer_name TO backend_field_staff_name;
    END IF;
END $$;

-- 4. Clean up old role
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
        -- Only delete if no users reference it (should comprise 0 users derived from Step 2)
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE role_id = 'field_officer') THEN
            DELETE FROM public.roles WHERE id = 'field_officer';
        END IF;
    END IF;
END $$;

-- 5. Update Permissions (if stored in DB, otherwise code handles it)
-- If there's a permissions table mapping roles to permissions, it needs update.
-- The app seems to use `store/permissionsStore.ts` for hardcoded mapping.
-- But if `roles` table has a `permissions` column?
-- checking schema... `roles` table only has `display_name`.
