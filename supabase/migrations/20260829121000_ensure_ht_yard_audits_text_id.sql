-- ============================================================================
-- Migration: Ensure ht_yard_audits accepts TEXT IDs (e.g. audit-demo-ecity, audit-1724...)
-- Date: 2026-08-29
-- ============================================================================

DO $$ 
BEGIN
  -- If ht_yard_audits table exists and id column is UUID, alter it to TEXT to support string IDs
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ht_yard_audits' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.ht_yard_audits ALTER COLUMN id TYPE TEXT USING id::TEXT;
  END IF;
END $$;
