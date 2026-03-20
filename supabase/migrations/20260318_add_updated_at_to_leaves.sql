-- Migration: Add updated_at column to leave_requests to allow sorting by recent actions

ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Set existing rows to use their created_at value as the initial updated_at
UPDATE public.leave_requests SET updated_at = created_at WHERE updated_at IS NULL;

-- Automatically update updated_at on row changes
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to leave_requests
DROP TRIGGER IF EXISTS set_updated_at ON public.leave_requests;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
