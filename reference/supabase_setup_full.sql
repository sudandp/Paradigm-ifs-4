-- Supabase schema setup for Paradigm‑IFS (full version)
--
-- This SQL script creates the core tables, triggers, functions and row‑level
-- security policies required by the Paradigm‑IFS application.  It extends
-- Supabase Auth by introducing application‑specific profile data, a roles
-- table for RBAC, a notifications system, onboarding submissions, an
-- attendance log and a user_documents table to track file uploads.  Policies
-- are defined without IF NOT EXISTS to avoid PostgreSQL syntax errors.

-- =============================================================
--  EXTENSIONS
-- =============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================
--  HELPER FUNCTION: update updated_at
-- =============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================
--  ROLES TABLE (application roles)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id           text PRIMARY KEY,
  display_name text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed some default roles
INSERT INTO public.roles (id, display_name) VALUES
  ('admin',           'Admin'),
  ('hr',              'HR'),
  ('developer',       'Developer'),
  ('field_staff',     'Field Staff'),
  ('operation_manager','Operation Manager'),
  ('site_manager',    'Site Manager'),
  ('unverified',      'Unverified')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
--  ORGANIZATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_name   text NOT NULL,
  full_name    text,
  address      text,
  manpower_approved_count integer,
  provisional_creation_date date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS organizations_set_updated_at ON public.organizations;
CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
--  LOCATION CACHE (Geocoding)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.location_cache (
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  address text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (latitude, longitude)
);

ALTER TABLE public.location_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read location cache' AND tablename = 'location_cache'
  ) THEN
    CREATE POLICY "Authenticated users can read location cache"
      ON public.location_cache FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert location cache' AND tablename = 'location_cache'
  ) THEN
    CREATE POLICY "Authenticated users can insert location cache"
      ON public.location_cache FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END$$;

-- =============================================================
--  USERS (profile table mapping to auth.users)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id                   uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name                 text,
  email                text UNIQUE,
  phone                text,
  role_id              text NOT NULL REFERENCES public.roles (id),
  organization_id      uuid REFERENCES public.organizations (id),
  organization_name    text,
  reporting_manager_id uuid REFERENCES public.users (id),
  photo_url            text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
--  NOTIFICATIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  message    text NOT NULL,
  type       text NOT NULL CHECK (type IN ('info','success','warning','error','greeting')),
  is_read    boolean NOT NULL DEFAULT false,
  link       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
  ON public.notifications (user_id, created_at DESC);

-- =============================================================
--  ONBOARDING SUBMISSIONS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.onboarding_submissions (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status        text NOT NULL,
  portal_sync_status text,
  organization_id uuid,
  personal      jsonb,
  bank          jsonb,
  uan           jsonb,
  esi           jsonb,
  education     jsonb,
  family        jsonb,
  gmc           jsonb,
  address       jsonb,
  enrollment_date date,
  manual_verification boolean,
  forms_generated jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS onboarding_submissions_set_updated_at ON public.onboarding_submissions;
CREATE TRIGGER onboarding_submissions_set_updated_at
BEFORE UPDATE ON public.onboarding_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
--  ATTENDANCE EVENTS
-- =============================================================
CREATE TABLE IF NOT EXISTS public.attendance_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN ('check_in','check_out')),
  event_time  timestamptz NOT NULL DEFAULT now(),
  latitude    numeric,
  longitude   numeric,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
--  USER DOCUMENTS (file uploads)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.user_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  submission_id text,
  name          text NOT NULL,
  bucket        text NOT NULL,
  path          text NOT NULL,
  file_type     text,
  file_size     bigint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS user_documents_set_updated_at ON public.user_documents;
CREATE TRIGGER user_documents_set_updated_at
BEFORE UPDATE ON public.user_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
--  FUNCTIONS
-- =============================================================
-- Insert a new profile row when a new auth.user signs up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role_id)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email, 'unverified')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE CONSTRAINT TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- =============================================================
--  ROW LEVEL SECURITY (RLS) & POLICIES
-- =============================================================

-- Enable RLS on key tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
--
-- PostgreSQL does not support `CREATE POLICY IF NOT EXISTS`, so wrap each policy definition
-- in a DO block that checks for the policy’s existence before creating it.  This prevents
-- errors if the policy already exists when running this script multiple times.
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Users can view their own profile' and tablename = 'users'
  ) then
    create policy "Users can view their own profile"
      on public.users
      for select
      using (auth.uid() = id);
  end if;
end$$;

-- Users can update their own profile (except role/organization which is restricted in app logic)
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Users can update their own profile' and tablename = 'users'
  ) then
    create policy "Users can update their own profile"
      on public.users
      for update
      using (auth.uid() = id);
  end if;
end$$;

-- Users can view their own notifications
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Users can view their own notifications' and tablename = 'notifications'
  ) then
    create policy "Users can view their own notifications"
      on public.notifications
      for select
      using (auth.uid() = user_id);
  end if;
end$$;

-- Users can mark their notifications as read
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Users can update their own notifications' and tablename = 'notifications'
  ) then
    create policy "Users can update their own notifications"
      on public.notifications
      for update
      using (auth.uid() = user_id);
  end if;
end$$;

-- Service or backend (with service_role key) can insert notifications
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Service can insert notifications' and tablename = 'notifications'
  ) then
    create policy "Service can insert notifications"
      on public.notifications
      for insert
      with check (true);
  end if;
end$$;

-- Users can manage their own onboarding submissions
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Users can manage their own onboarding submissions' and tablename = 'onboarding_submissions'
  ) then
    create policy "Users can manage their own onboarding submissions"
      on public.onboarding_submissions
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

-- Users can manage their own uploaded documents
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'Users can manage their own documents' and tablename = 'user_documents'
  ) then
    create policy "Users can manage their own documents"
      on public.user_documents
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end$$;

-- All authenticated users can read application settings
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'All authenticated users can read settings' and tablename = 'settings'
  ) then
    create policy "All authenticated users can read settings"
      on public.settings
      for select
      using (auth.role() = 'authenticated');
  end if;
end$$;

-- All authenticated users can read holidays
do $$
begin
  if not exists (
    select 1 from pg_policies where polname = 'All authenticated users can read holidays' and tablename = 'holidays'
  ) then
    create policy "All authenticated users can read holidays"
      on public.holidays
      for select
      using (auth.role() = 'authenticated');
  end if;
end$$;

-- (Optional) Admin examples: uncomment and adjust to grant admin full access
-- CREATE POLICY "Admins can manage all users" ON public.users FOR ALL USING (exists (select 1 from public.users u where u.id = auth.uid() and u.role_id = 'admin'));
-- CREATE POLICY "Admins can manage all documents" ON public.user_documents FOR ALL USING (exists (select 1 from public.users u where u.id = auth.uid() and u.role_id = 'admin'));

-- =============================================================
--  SETTINGS & HOLIDAYS (seed data)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id                  text PRIMARY KEY,
  enrollment_rules    jsonb,
  attendance_settings jsonb,
  api_settings        jsonb,
  verification_costs  jsonb,
  backoffice_id_series jsonb,
  master_tools_list   jsonb,
  master_uniform_list jsonb,
  approval_workflows  jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS settings_set_updated_at ON public.settings;
CREATE TRIGGER settings_set_updated_at
BEFORE UPDATE ON public.settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.holidays (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  date        date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed a singleton settings row if not present
INSERT INTO public.settings (id)
VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
--  GEOFENCING SUPPORT (Locations and user_locations)
--  Define geofenced locations and assign them to users.  Each location
--  has a center point and radius (meters).  A nullable foreign key on
--  attendance_events references the location used for a check‑in/out.
-- =============================================================

-- Table of geofenced locations
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  radius numeric NOT NULL,
  -- Optional address stored for human readable display
  address text,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Assignment table linking users to locations (many‑to‑many)
CREATE TABLE IF NOT EXISTS public.user_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Extend attendance_events to reference a geofenced location
ALTER TABLE public.attendance_events
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.locations(id);

-- Enable RLS on new tables
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Policies:
--  * Anyone can read locations (for distance checks)
--  * Authenticated users (admin, HR, or general) can insert locations
--  * Authenticated users can assign locations to users
--  * Users can read their own location assignments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Public read locations' AND tablename = 'locations'
  ) THEN
    CREATE POLICY "Public read locations"
      ON public.locations
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Authenticated insert locations' AND tablename = 'locations'
  ) THEN
    CREATE POLICY "Authenticated insert locations"
      ON public.locations
      FOR INSERT
      WITH CHECK (auth.role() IN ('admin','hr','authenticated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Authenticated insert user_locations' AND tablename = 'user_locations'
  ) THEN
    CREATE POLICY "Authenticated insert user_locations"
      ON public.user_locations
      FOR INSERT
      WITH CHECK (auth.role() IN ('admin','hr','authenticated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'Users read their location assignments' AND tablename = 'user_locations'
  ) THEN
    CREATE POLICY "Users read their location assignments"
      ON public.user_locations
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

-- End of full schema setup