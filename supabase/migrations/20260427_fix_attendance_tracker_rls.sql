-- ==============================================================================
-- Migration: Add RLS policies for site_attendance_tracker
-- Resolves "RLS Enabled No Policy" (INFO) in Supabase Security Advisor
-- ==============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.site_attendance_tracker ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 1. Create a broad management policy for administrative roles
  -- This allows admin, hr, operation_manager, and finance roles to manage site attendance data.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Managers and Admins can manage site attendance tracker' AND tablename = 'site_attendance_tracker'
  ) THEN
    CREATE POLICY "Managers and Admins can manage site attendance tracker"
      ON public.site_attendance_tracker FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE users.id = auth.uid() 
          AND (
            role_id IN ('admin', 'hr', 'super_admin', 'operation_manager', 'finance', 'finance_manager', 'developer')
            OR LOWER(REPLACE(role_id, '_', ' ')) IN ('admin', 'hr', 'super admin', 'operation manager', 'finance', 'finance manager', 'developer')
          )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE users.id = auth.uid() 
          AND (
            role_id IN ('admin', 'hr', 'super_admin', 'operation_manager', 'finance', 'finance_manager', 'developer')
            OR LOWER(REPLACE(role_id, '_', ' ')) IN ('admin', 'hr', 'super admin', 'operation manager', 'finance', 'finance manager', 'developer')
          )
        )
      );
  END IF;

  -- 2. Optional: Allow read-only access to other authenticated users if needed for dashboard visibility
  -- Since site_attendance_tracker contains billing info, we keep it restricted to managers by default.
  
END$$;
