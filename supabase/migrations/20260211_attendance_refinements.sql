-- Consolidated Attendance Database Fix
-- Migration: 20260211_attendance_refinements.sql
-- Description: Adds salary hold columns, creates unlock requests and violation resets tables.

-- 1. Update Users Table with Salary Hold columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS salary_hold BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS salary_hold_reason TEXT,
ADD COLUMN IF NOT EXISTS salary_hold_date TIMESTAMPTZ;

-- 2. Create Attendance Unlock Requests table
CREATE TABLE IF NOT EXISTS public.attendance_unlock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES public.users(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Unlock Requests
ALTER TABLE public.attendance_unlock_requests ENABLE ROW LEVEL SECURITY;

-- 3. Create Violation Resets table
CREATE TABLE IF NOT EXISTS public.violation_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reset_month TEXT NOT NULL, -- Format: YYYY-MM
    previous_violation_count INTEGER NOT NULL,
    reset_by UUID NOT NULL REFERENCES public.users(id),
    reset_reason TEXT NOT NULL,
    reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for Violation Resets
ALTER TABLE public.violation_resets ENABLE ROW LEVEL SECURITY;

-- --- POLICIES FOR UNLOCK REQUESTS ---

-- Drop existing policies if they exist to avoid errors
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view their own requests" ON public.attendance_unlock_requests;
    DROP POLICY IF EXISTS "Users can create their own requests" ON public.attendance_unlock_requests;
    DROP POLICY IF EXISTS "Managers can view team requests" ON public.attendance_unlock_requests;
    DROP POLICY IF EXISTS "Managers can update team requests" ON public.attendance_unlock_requests;
    DROP POLICY IF EXISTS "Admins have full access to unlock requests" ON public.attendance_unlock_requests;
    DROP POLICY IF EXISTS "Admins can view reset history" ON public.violation_resets;
    DROP POLICY IF EXISTS "Admins can insert resets" ON public.violation_resets;
END $$;

CREATE POLICY "Users can view their own requests" 
ON public.attendance_unlock_requests FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own requests" 
ON public.attendance_unlock_requests FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can view team requests" 
ON public.attendance_unlock_requests FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = public.attendance_unlock_requests.user_id 
        AND public.users.reporting_manager_id = auth.uid()
    )
);

CREATE POLICY "Managers can update team requests" 
ON public.attendance_unlock_requests FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = public.attendance_unlock_requests.user_id 
        AND public.users.reporting_manager_id = auth.uid()
    )
);

-- --- POLICIES FOR VIOLATION RESETS ---

CREATE POLICY "Admins can view reset history" 
ON public.violation_resets FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() 
        AND public.users.role_id IN ('admin', 'management', 'hr')
    )
);

CREATE POLICY "Admins can insert resets" 
ON public.violation_resets FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() 
        AND public.users.role_id IN ('admin', 'management', 'hr')
    )
);

-- --- GENERAL ADMIN POLICY ---

CREATE POLICY "Admins have full access to unlock requests" 
ON public.attendance_unlock_requests FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() 
        AND public.users.role_id IN ('admin', 'management', 'hr')
    )
);
