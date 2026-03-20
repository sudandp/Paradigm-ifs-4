-- Create user_holidays table
CREATE TABLE IF NOT EXISTS public.user_holidays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    holiday_name TEXT NOT NULL,
    holiday_date DATE NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    -- Ensure a user can't select the same holiday twice for the same year (redundant but good)
    UNIQUE(user_id, holiday_name, year)
);

-- Enable RLS
ALTER TABLE public.user_holidays ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own holiday selections"
    ON public.user_holidays FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own holiday selections"
    ON public.user_holidays FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Admin Policy
CREATE POLICY "Admins can view all holiday selections"
    ON public.user_holidays FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role_id IN ('admin', 'hr')
        )
    );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_holidays_user_id ON public.user_holidays(user_id);
CREATE INDEX IF NOT EXISTS idx_user_holidays_year ON public.user_holidays(year);
