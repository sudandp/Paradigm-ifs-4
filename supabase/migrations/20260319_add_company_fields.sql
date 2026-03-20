ALTER TABLE "public"."companies" 
ADD COLUMN IF NOT EXISTS "location" text,
ADD COLUMN IF NOT EXISTS "address" text,
ADD COLUMN IF NOT EXISTS "logo_url" text;

-- Create the logo bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('logo', 'logo', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access for logo'
  ) THEN
    CREATE POLICY "Public Access for logo" ON storage.objects FOR SELECT USING (bucket_id = 'logo');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth Upload for logo'
  ) THEN
    CREATE POLICY "Auth Upload for logo" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logo' AND auth.role() = 'authenticated');
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth Update for logo'
  ) THEN
    CREATE POLICY "Auth Update for logo" ON storage.objects FOR UPDATE USING (bucket_id = 'logo' AND auth.role() = 'authenticated');
  END IF;
END $$;
