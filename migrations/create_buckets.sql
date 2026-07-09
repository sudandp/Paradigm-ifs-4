-- Create onboarding-documents bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('onboarding-documents', 'onboarding-documents', true)
on conflict (id) do nothing;

-- Create compliance-documents bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('compliance-documents', 'compliance-documents', true)
on conflict (id) do nothing;

-- Set up basic access policies for onboarding-documents
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'onboarding-documents' );

DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
create policy "Authenticated users can upload files"
  on storage.objects for insert
  with check ( bucket_id = 'onboarding-documents' and auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
create policy "Users can update their own files"
  on storage.objects for update
  using ( bucket_id = 'onboarding-documents' and auth.uid() = owner )
  with check ( bucket_id = 'onboarding-documents' and auth.uid() = owner );

DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
create policy "Users can delete their own files"
  on storage.objects for delete
  using ( bucket_id = 'onboarding-documents' and auth.uid() = owner );

-- Set up basic access policies for compliance-documents
DROP POLICY IF EXISTS "Public Access compliance" ON storage.objects;
create policy "Public Access compliance"
  on storage.objects for select
  using ( bucket_id = 'compliance-documents' );

DROP POLICY IF EXISTS "Authenticated users can upload compliance files" ON storage.objects;
create policy "Authenticated users can upload compliance files"
  on storage.objects for insert
  with check ( bucket_id = 'compliance-documents' and auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Users can update their own compliance files" ON storage.objects;
create policy "Users can update their own compliance files"
  on storage.objects for update
  using ( bucket_id = 'compliance-documents' and auth.uid() = owner )
  with check ( bucket_id = 'compliance-documents' and auth.uid() = owner );

DROP POLICY IF EXISTS "Users can delete their own compliance files" ON storage.objects;
create policy "Users can delete their own compliance files"
  on storage.objects for delete
  using ( bucket_id = 'compliance-documents' and auth.uid() = owner );
