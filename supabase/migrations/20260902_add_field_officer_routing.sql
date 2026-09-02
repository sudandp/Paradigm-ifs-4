-- Add Field Officer and Site Manager routing columns to site_responsibility_matrix
DO $$
BEGIN
  -- 1. Field Officer Columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'site_responsibility_matrix' 
      AND column_name = 'field_officer_name'
  ) THEN
    ALTER TABLE public.site_responsibility_matrix ADD COLUMN field_officer_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'site_responsibility_matrix' 
      AND column_name = 'field_officer_id'
  ) THEN
    ALTER TABLE public.site_responsibility_matrix ADD COLUMN field_officer_id UUID;
  END IF;

  -- 2. Site Manager / Supervisor Columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'site_responsibility_matrix' 
      AND column_name = 'site_supervisor_name'
  ) THEN
    ALTER TABLE public.site_responsibility_matrix ADD COLUMN site_supervisor_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'site_responsibility_matrix' 
      AND column_name = 'site_supervisor_id'
  ) THEN
    ALTER TABLE public.site_responsibility_matrix ADD COLUMN site_supervisor_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'site_responsibility_matrix' 
      AND column_name = 'site_manager_name'
  ) THEN
    ALTER TABLE public.site_responsibility_matrix ADD COLUMN site_manager_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'site_responsibility_matrix' 
      AND column_name = 'site_manager_id'
  ) THEN
    ALTER TABLE public.site_responsibility_matrix ADD COLUMN site_manager_id UUID;
  END IF;
END $$;

-- Reload Supabase PostgREST schema cache
NOTIFY pgrst, 'reload schema';
