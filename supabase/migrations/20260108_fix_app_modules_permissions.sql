-- Release any constraints on app_modules permissions column
-- This fixes the 400 Bad Request error when saving modules with new permission types

DO $$ 
BEGIN
    -- Attempt to drop check constraint if it exists
    ALTER TABLE public.app_modules DROP CONSTRAINT IF EXISTS app_modules_permissions_check;
    
    -- Attempt to drop any restrictive trigger (if common naming was used)
    DROP TRIGGER IF EXISTS validate_module_permissions_trigger ON public.app_modules;
    DROP FUNCTION IF EXISTS validate_module_permissions();

EXCEPTION
    WHEN OTHERS THEN 
        RAISE NOTICE 'Error dropping constraints: %', SQLERRM;
END $$;
