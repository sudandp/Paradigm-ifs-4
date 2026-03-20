-- Supabase configuration script to enable avatar uploads and profile updates

-- This script creates the avatars bucket (if it does not exist) and makes it public.
insert into storage.buckets (id, name, public)
select 'avatars', 'avatars', true
where not exists (
  select 1 from storage.buckets where id = 'avatars'
);

-- Allow public read access to avatar images
do $$
begin
  if not exists (
    select 1 from pg_policies
    where polname = 'Public read avatars' and tablename = 'objects'
  ) then
    create policy "Public read avatars"
      on storage.objects
      for select
      using (bucket_id = 'avatars');
  end if;
end$$;

-- Allow authenticated users to insert avatar files
do $$
begin
  if not exists (
    select 1 from pg_policies
    where polname = 'Authenticated insert avatars' and tablename = 'objects'
  ) then
    create policy "Authenticated insert avatars"
      on storage.objects
      for insert
      with check (
        bucket_id = 'avatars' and auth.role() = 'authenticated'
      );
  end if;
end$$;

-- Allow authenticated users to update avatar files
do $$
begin
  if not exists (
    select 1 from pg_policies
    where polname = 'Authenticated update avatars' and tablename = 'objects'
  ) then
    create policy "Authenticated update avatars"
      on storage.objects
      for update
      using (
        bucket_id = 'avatars' and auth.role() = 'authenticated'
      )
      with check (
        bucket_id = 'avatars' and auth.role() = 'authenticated'
      );
  end if;
end$$;

-- Allow authenticated users to delete their avatar files
do $$
begin
  if not exists (
    select 1 from pg_policies
    where polname = 'Authenticated delete avatars' and tablename = 'objects'
  ) then
    create policy "Authenticated delete avatars"
      on storage.objects
      for delete
      using (
        bucket_id = 'avatars' and auth.role() = 'authenticated'
      );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- Geofencing support
--
-- Create a table to store named geofenced locations with a radius (in meters).
-- Admins or HR can manage these locations.  Each location includes a
-- latitude/longitude and a radius defining the circular geofence.  A
-- separate linking table assigns locations to individual users to allow
-- personalized geofences.  We also add a nullable foreign key column to
-- attendance_events so each attendance entry can reference the geofence used.

-- Locations table
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text,
  latitude numeric not null,
  longitude numeric not null,
  radius numeric not null,
  -- Optional human‑readable address (e.g. street/area/city).  This may be
  -- populated by the application using a reverse geocoding service.  When
  -- blank, the raw coordinates can be shown instead.
  address text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz default now()
);

-- Add address column if it doesn't exist on existing installations
alter table public.locations
  add column if not exists address text;

-- Many‑to‑many assignment of locations to users
create table if not exists public.user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz default now()
);

-- Add a nullable location_id column to attendance_events if it doesn't already exist
alter table public.attendance_events
  add column if not exists location_id uuid references public.locations(id);

-- Enable row level security on new tables
alter table public.locations enable row level security;
alter table public.user_locations enable row level security;

-- Allow everyone to read locations (used for distance checking)
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Public read locations' and tablename = 'locations'
  ) then
    create policy "Public read locations"
      on public.locations
      for select
      using (true);
  end if;
end$$;

-- Only admins and HR can insert new locations on behalf of the organization.  Users can insert
-- their own geolocations via application logic, but RLS will allow any authenticated role to insert.
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Authenticated insert locations' and tablename = 'locations'
  ) then
    create policy "Authenticated insert locations"
      on public.locations
      for insert
      with check (auth.role() in ('admin','hr','authenticated'));
  end if;
end$$;

-- Allow location assignments by admins or hr
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Authenticated insert user_locations' and tablename = 'user_locations'
  ) then
    create policy "Authenticated insert user_locations"
      on public.user_locations
      for insert
      with check (auth.role() in ('admin','hr','authenticated'));
  end if;
end$$;

-- Allow users to read their own assignments
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Users read their location assignments' and tablename = 'user_locations'
  ) then
    create policy "Users read their location assignments"
      on public.user_locations
      for select
      using (auth.uid() = user_id);
  end if;
end$$;

-- Create or update the profiles table for storing user details
create table if not exists public.profiles (
  id uuid primary key default auth.uid(),
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Enable row level security on the profiles table
alter table public.profiles enable row level security;

-- Each user can select their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where polname = 'Profiles select own' and tablename = 'profiles'
  ) then
    create policy "Profiles select own"
      on public.profiles
      for select
      using (auth.uid() = id);
  end if;
end$$;

-- Each user can update their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where polname = 'Profiles update own' and tablename = 'profiles'
  ) then
    create policy "Profiles update own"
      on public.profiles
      for update
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end$$;