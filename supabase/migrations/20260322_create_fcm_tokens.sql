-- Create a table for storing FCM tokens
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    last_seen TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON public.fcm_tokens(token);

-- Enable RLS
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/edit their own tokens
CREATE POLICY "Users can manage their own tokens" 
ON public.fcm_tokens 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to handle token rotation/updates
CREATE OR REPLACE FUNCTION public.handle_fcm_token_upsert()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_seen if the token already exists
    NEW.last_seen := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_seen on conflict (handled by upsert in code, but good to have)
-- Note: Supabase upsert will handle this, but if we do raw SQL we might want a trigger.
