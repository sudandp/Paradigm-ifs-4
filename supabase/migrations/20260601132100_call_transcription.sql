-- Migration: Call Transcription System (Phase 3)
-- Date: 2026-06-01

-- 1. Create connected_devices table
CREATE TABLE IF NOT EXISTS public.connected_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hr_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    adb_status TEXT NOT NULL CHECK (adb_status IN ('connected', 'disconnected', 'error')),
    last_ping TIMESTAMPTZ DEFAULT now(),
    auth_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create call_recordings table
CREATE TABLE IF NOT EXISTS public.call_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hr_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    candidate_id UUID REFERENCES public.candidate_referrals(id) ON DELETE SET NULL,
    phone_number TEXT,
    duration_seconds INT,
    s3_path TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create call_transcripts table
CREATE TABLE IF NOT EXISTS public.call_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id UUID REFERENCES public.call_recordings(id) ON DELETE CASCADE UNIQUE,
    call_log_id UUID REFERENCES public.hrm_call_logs(id) ON DELETE SET NULL,
    transcript_text TEXT,
    summary TEXT,
    candidate_interest TEXT CHECK (candidate_interest IN ('High', 'Medium', 'Low', null)),
    key_points JSONB,
    action_items JSONB,
    follow_up_date DATE,
    suggested_stage TEXT CHECK (suggested_stage IN ('new', 'contacted', 'screened', 'interview', 'offer', 'joined', 'rejected', null)),
    call_outcome TEXT CHECK (call_outcome IN ('reached', 'no_answer', 'callback', 'not_interested', 'interested', null)),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.connected_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Scoped to the authenticated HR user
DROP POLICY IF EXISTS "connected_devices_user" ON public.connected_devices;
CREATE POLICY "connected_devices_user" ON public.connected_devices 
FOR ALL USING (auth.role() = 'authenticated' AND hr_user_id = auth.uid());

DROP POLICY IF EXISTS "call_recordings_user" ON public.call_recordings;
CREATE POLICY "call_recordings_user" ON public.call_recordings 
FOR ALL USING (auth.role() = 'authenticated' AND hr_user_id = auth.uid());

DROP POLICY IF EXISTS "call_transcripts_user" ON public.call_transcripts;
CREATE POLICY "call_transcripts_user" ON public.call_transcripts 
FOR ALL USING (
    auth.role() = 'authenticated' AND 
    (SELECT hr_user_id FROM public.call_recordings WHERE id = recording_id) = auth.uid()
);

-- 6. Storage Bucket setup and Policies
-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('call-recordings', 'call-recordings', false) 
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the call-recordings bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to call-recordings" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to call-recordings"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'call-recordings');

DROP POLICY IF EXISTS "Allow authenticated reads from call-recordings" ON storage.objects;
CREATE POLICY "Allow authenticated reads from call-recordings"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'call-recordings');

DROP POLICY IF EXISTS "Allow service role all operations" ON storage.objects;
CREATE POLICY "Allow service role all operations"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'call-recordings');
