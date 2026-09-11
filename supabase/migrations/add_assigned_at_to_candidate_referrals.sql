-- Migration: Add assigned_at column to candidate_referrals
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'candidate_referrals' 
          AND column_name = 'assigned_at'
    ) THEN
        ALTER TABLE public.candidate_referrals ADD COLUMN assigned_at TIMESTAMPTZ DEFAULT NOW();
        
        -- Backfill existing assigned rows with created_at if assigned_hr_id is present
        UPDATE public.candidate_referrals
        SET assigned_at = created_at
        WHERE assigned_hr_id IS NOT NULL AND assigned_at IS NULL;
    END IF;
END $$;
