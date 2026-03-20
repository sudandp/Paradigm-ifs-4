-- Migration: Add gender column to users + user_children table + birth-certificates bucket
-- Run this in the Supabase SQL Editor

-- 1. Gender column on users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender text;

-- 2. Children details table
CREATE TABLE IF NOT EXISTS public.user_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  child_name text NOT NULL,
  date_of_birth date NOT NULL,
  birth_certificate_url text,
  verification_status text DEFAULT 'pending'
    CHECK (verification_status IN ('pending','approved','rejected')),
  verified_by uuid REFERENCES public.users(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Trigger for updated_at
DROP TRIGGER IF EXISTS user_children_updated_at ON public.user_children;
CREATE TRIGGER user_children_updated_at
BEFORE UPDATE ON public.user_children
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Enable RLS
ALTER TABLE public.user_children ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own children' AND tablename = 'user_children'
  ) THEN
    CREATE POLICY "Users can view their own children"
      ON public.user_children FOR SELECT USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own children' AND tablename = 'user_children'
  ) THEN
    CREATE POLICY "Users can insert their own children"
      ON public.user_children FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own children' AND tablename = 'user_children'
  ) THEN
    CREATE POLICY "Users can update their own children"
      ON public.user_children FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own children' AND tablename = 'user_children'
  ) THEN
    CREATE POLICY "Users can delete their own children"
      ON public.user_children FOR DELETE USING (auth.uid() = user_id);
  END IF;
END$$;

-- Allow admins/HR/managers to read/update children for verification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated read all children' AND tablename = 'user_children'
  ) THEN
    CREATE POLICY "Authenticated read all children"
      ON public.user_children FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated update children verification' AND tablename = 'user_children'
  ) THEN
    CREATE POLICY "Authenticated update children verification"
      ON public.user_children FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END$$;

-- 6. Storage bucket for birth certificates
INSERT INTO storage.buckets (id, name, public)
SELECT 'birth-certificates', 'birth-certificates', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'birth-certificates'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read birth-certificates' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public read birth-certificates"
      ON storage.objects FOR SELECT USING (bucket_id = 'birth-certificates');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated insert birth-certificates' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated insert birth-certificates"
      ON storage.objects FOR INSERT WITH CHECK (
        bucket_id = 'birth-certificates' AND auth.role() = 'authenticated'
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated delete birth-certificates' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated delete birth-certificates"
      ON storage.objects FOR DELETE USING (
        bucket_id = 'birth-certificates' AND auth.role() = 'authenticated'
      );
  END IF;
END$$;
