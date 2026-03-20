
-- Migration to add communication_logs table for tracking in-app interactions

CREATE TABLE IF NOT EXISTS public.communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('call', 'sms', 'whatsapp', 'ping')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view communication logs they are part of" 
ON public.communication_logs FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert their own communication logs" 
ON public.communication_logs FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Admin/Management can view all logs
CREATE POLICY "Managers can view all communication logs" 
ON public.communication_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role_id IN ('admin', 'management', 'site_manager')
  )
);
