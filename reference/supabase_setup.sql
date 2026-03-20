-- Supabase schema setup for Paradigm-IFS
--
-- This script defines core tables, roles, triggers and seed data required
-- to support the Paradigm‑IFS application.  It includes a users table
-- linked to Supabase Auth, roles for RBAC, a notifications table for
-- system messages, and basic helpers to maintain timestamps.

-- Enable the pgcrypto extension for gen_random_uuid() if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------
-- Roles
-- -------------------------------
-- Each application role corresponds to a particular set of permissions in
-- the frontend.  The id column acts as the primary key and is used
-- throughout the app when assigning roles to users.
CREATE TABLE IF NOT EXISTS public.roles (
  id text PRIMARY KEY,
  display_name text NOT NULL
);

-- Seed default roles.  Use ON CONFLICT to avoid duplicate inserts when
-- re‑running this script.
INSERT INTO public.roles (id, display_name) VALUES
  ('admin', 'Admin'),
  ('hr', 'HR'),
  ('developer', 'Developer'),
  ('field_staff', 'Field Staff'),
  ('operation_manager', 'Operation Manager'),
  ('site_manager', 'Site Manager'),
  ('unverified', 'Unverified')
ON CONFLICT DO NOTHING;

-- -------------------------------
-- Organizations
-- -------------------------------
-- Organizations represent client entities or sites.  Users can be
-- associated with an organization via organization_id and organization_name.
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_name text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger to maintain updated_at on organizations
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------
-- Users
-- -------------------------------
-- The users table extends auth.users with additional profile fields.
-- It uses the same primary key (uuid) as auth.users and enforces a
-- 1‑to‑1 relationship.  When a user is removed from auth.users, the
-- corresponding profile row is also removed via ON DELETE CASCADE.
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text,
  email text UNIQUE,
  phone text,
  role_id text REFERENCES public.roles (id),
  organization_id uuid REFERENCES public.organizations (id),
  organization_name text,
  reporting_manager_id uuid REFERENCES public.users (id),
  photo_url text,
  gender text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------
-- Notifications
-- -------------------------------
-- Notifications are delivered to a user via the UI.  Each record
-- includes a type (info, success, error, warning, greeting), a text
-- message and read status.  Notifications are soft‑owned by the user
-- and cascade deleted when the user profile is removed.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('info','success','warning','error','greeting')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quickly retrieving notifications by user and creation date
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx
ON public.notifications (user_id, created_at DESC);

-- -------------------------------
-- Enrollment & Onboarding (simplified)
-- -------------------------------
-- The onboarding_submissions table stores multi‑page onboarding data
-- submitted by employees.  For brevity only a subset of fields is
-- included.  Documents and images uploaded during onboarding are
-- stored in Supabase Storage and referenced by path.  The application
-- retrieves public URLs when displaying documents.
CREATE TABLE IF NOT EXISTS public.onboarding_submissions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL,
  personal jsonb,
  bank jsonb,
  uan jsonb,
  esi jsonb,
  education jsonb,
  family jsonb,
  gmc jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER onboarding_submissions_updated_at
BEFORE UPDATE ON public.onboarding_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------
-- Attendance (simplified)
-- -------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('check_in','check_out')),
  event_time timestamptz NOT NULL DEFAULT now(),
  latitude numeric,
  longitude numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------
-- Functions
-- -------------------------------
-- Helper function to assign the default role 'unverified' to a new user
-- when they sign up via Supabase Auth.  This function can be called
-- from a Supabase Edge Function or trigger.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role_id)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email, 'unverified')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the handle_new_auth_user function to auth.users.  When a
-- Supabase Auth user is created, a corresponding profile row will be
-- inserted into public.users.  Use deferrable initially deferred to
-- avoid cross‑schema dependency issues during creation.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE CONSTRAINT TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- -------------------------------
-- Row‑level security
-- -------------------------------
-- Enable RLS on users and notifications so that users can only read
-- their own data.  Admin roles can be granted separate policies via
-- Supabase dashboard.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow a user to select their own profile

-- Create policies conditionally: PostgreSQL does not support IF NOT EXISTS on CREATE POLICY.
-- We use a DO block to check for an existing policy before creating it.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where polname = 'Users can view their own profile' and tablename = 'users'
  ) then
    create policy "Users can view their own profile" on public.users
      for select using (auth.uid() = id);
  end if;
end$$;

-- Allow users to read their own notifications
do $$
begin
  if not exists (
    select 1 from pg_policies
    where polname = 'Users can view their own notifications' and tablename = 'notifications'
  ) then
    create policy "Users can view their own notifications" on public.notifications
      for select using (auth.uid() = user_id);
  end if;
end$$;

-- Allow users to insert notifications for themselves
do $$
begin
  if not exists (
    select 1 from pg_policies
    where polname = 'Users can insert notifications for themselves' and tablename = 'notifications'
  ) then
    create policy "Users can insert notifications for themselves" on public.notifications
      for insert with check (auth.uid() = user_id);
  end if;
end$$;

-- Grant admin role full access to users and notifications (example)
-- (Assumes admin role is mapped via supabase.auth.execute_sql or JWT claims)
-- Additional policies may be added in the Supabase dashboard as needed.

-- End of script