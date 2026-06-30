-- =============================================
-- COMPLETE SUPABASE DATABASE EXPORT
-- Project: fmyafuhxlorbafbacywa
-- Generated: 2025-12-04
-- =============================================
-- This file contains:
-- - Extensions
-- - Tables (auth, public, storage schemas)
-- - Primary Keys
-- - Foreign Keys
-- - Indexes
-- - Functions
-- - Triggers
-- - RLS Policies
-- =============================================

-- =============================================
-- EXTENSIONS
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLES - AUTH SCHEMA (Managed by Supabase auth engine - omitted to avoid permission denied error)
-- =============================================

-- =============================================
-- TABLES - PUBLIC SCHEMA
-- =============================================

CREATE TABLE IF NOT EXISTS public.app_modules (  name TEXT NOT NULL,
  permissions _text DEFAULT '{}'::text[] NOT NULL,
  description TEXT,
  id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.attendance_approvals (  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  manager_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL,
  rejection_reason TEXT,
  check_out_time TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.attendance_events (  type TEXT NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  longitude DOUBLE PRECISION,
  location_id UUID,
  latitude DOUBLE PRECISION,
  "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS public.comp_off_logs (  status TEXT DEFAULT 'earned'::text NOT NULL,
  reason TEXT NOT NULL,
  user_name TEXT,
  date_earned DATE NOT NULL,
  granted_by_name TEXT,
  leave_request_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  granted_by_id UUID,
  user_id UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS public.companies (  name TEXT NOT NULL,
  id TEXT NOT NULL,
  group_id TEXT
);

CREATE TABLE IF NOT EXISTS public.entities (  insurance_ids _text DEFAULT '{}'::text[],
  psara_valid_till TEXT,
  psara_license_number TEXT,
  e_shram_number TEXT,
  email TEXT,
  pan_number TEXT,
  gst_number TEXT,
  registration_number TEXT,
  registration_type TEXT,
  registered_address TEXT,
  location TEXT,
  organization_id TEXT,
  name TEXT NOT NULL,
  esic_code TEXT,
  epfo_code TEXT,
  shop_and_establishment_code TEXT,
  id TEXT NOT NULL,
  policy_ids _text DEFAULT '{}'::text[],
  company_id TEXT
);

CREATE TABLE IF NOT EXISTS public.extra_work_logs (  claim_type TEXT NOT NULL,
  id UUID DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL,
  work_date DATE NOT NULL,
  hours_worked NUMERIC,
  approver_id UUID,
  reason TEXT NOT NULL,
  rejection_reason TEXT,
  user_name TEXT,
  status TEXT DEFAULT 'Pending'::text NOT NULL,
  work_type TEXT NOT NULL,
  approver_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.holidays (  type TEXT,
  date DATE NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.insurances (  type TEXT NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  valid_till DATE NOT NULL,
  policy_number TEXT NOT NULL,
  provider TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.leave_requests (  start_date DATE NOT NULL,
  user_id UUID NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  leave_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL,
  doctor_certificate JSONB,
  approval_history JSONB,
  current_approver_id UUID,
  end_date DATE NOT NULL,
  day_option TEXT
);

CREATE TABLE IF NOT EXISTS public.location_cache (  latitude NUMERIC NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  longitude NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS public.locations (  radius NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID,
  longitude NUMERIC NOT NULL,
  latitude NUMERIC NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  name TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS public.notifications (  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  is_read BOOLEAN DEFAULT false,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link_to TEXT
);

CREATE TABLE IF NOT EXISTS public.onboarding_submissions (  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  organization JSONB,
  organization_name TEXT,
  address JSONB,
  organization_id TEXT,
  education JSONB,
  biometrics JSONB,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  enrollment_date DATE NOT NULL,
  family JSONB,
  requires_manual_verification BOOLEAN DEFAULT false,
  forms_generated BOOLEAN DEFAULT false,
  uniforms JSONB,
  status TEXT NOT NULL,
  portal_sync_status TEXT,
  created_user_id UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  personal JSONB,
  employee_id TEXT,
  gmc JSONB,
  esi JSONB,
  uan JSONB,
  bank JSONB,
  verification_usage JSONB,
  salary_change_request JSONB
);

CREATE TABLE IF NOT EXISTS public.organization_groups (  name TEXT NOT NULL,
  id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.organizations (  field_officer_names _text,
  manager_name TEXT,
  short_name TEXT NOT NULL,
  backend_field_officer_names _text,
  reporting_manager_name TEXT,
  provisional_creation_date TIMESTAMP WITH TIME ZONE,
  full_name TEXT NOT NULL,
  id TEXT NOT NULL,
  address TEXT,
  manpower_approved_count INTEGER
);

CREATE TABLE IF NOT EXISTS public.policies (  description TEXT,
  name TEXT NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.recurring_holidays (  id UUID DEFAULT gen_random_uuid() NOT NULL,
  role_type TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  occurrence INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.roles (  display_name TEXT NOT NULL,
  id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.settings (  attendance_settings JSONB,
  approval_workflow_settings JSONB,
  master_ladies_uniforms JSONB,
  master_gents_uniforms JSONB,
  master_tools JSONB,
  id TEXT DEFAULT 'singleton'::text NOT NULL,
  site_staff_designations JSONB,
  back_office_id_series JSONB,
  verification_costs JSONB,
  enrollment_rules JSONB,
  api_settings JSONB,
  gmc_policy JSONB,
  address_settings JSONB,
  gemini_api_settings JSONB,
  offline_ocr_settings JSONB,
  perfios_api_settings JSONB,
  otp_settings JSONB,
  site_management_settings JSONB,
  notification_settings JSONB
);

CREATE TABLE IF NOT EXISTS public.site_configurations (  config_data JSONB,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  organization_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.site_gents_uniform_configs (  config_data JSONB,
  organization_id TEXT NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.site_ladies_uniform_configs (  organization_id TEXT NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  config_data JSONB
);

CREATE TABLE IF NOT EXISTS public.site_staff_designations (  id UUID DEFAULT gen_random_uuid() NOT NULL,
  designation TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_uniform_details_configs (  organization_id TEXT NOT NULL,
  config_data JSONB,
  id UUID DEFAULT gen_random_uuid() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.support_tickets (  raised_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  posts JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  assigned_to_id UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  raised_by_name TEXT NOT NULL,
  feedback TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  assigned_to_name TEXT,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  raised_by_id UUID NOT NULL,
  title TEXT NOT NULL,
  rating INTEGER,
  ticket_number TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tasks (  name TEXT NOT NULL,
  description TEXT,
  assigned_to_id UUID,
  completion_photo JSONB,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  escalation_level1_user_id UUID,
  escalation_level1_duration_days INTEGER,
  completion_notes TEXT,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  escalation_status TEXT,
  escalation_level2_user_id UUID,
  escalation_level2_duration_days INTEGER,
  escalation_email_duration_days INTEGER,
  due_date DATE,
  escalation_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by_id UUID
);

CREATE TABLE IF NOT EXISTS public.ticket_comments (  content TEXT,
  post_id UUID NOT NULL,
  author_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  author_name TEXT,
  id UUID DEFAULT uuid_generate_v4() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ticket_posts (  author_id UUID,
  content TEXT,
  author_role TEXT,
  author_name TEXT,
  likes _uuid DEFAULT ARRAY[]::uuid[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ticket_id UUID NOT NULL,
  id UUID DEFAULT uuid_generate_v4() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.uniform_requests (  requested_by_name TEXT,
  site_id TEXT NOT NULL,
  site_name TEXT NOT NULL,
  source TEXT,
  gender TEXT NOT NULL,
  requested_date TIMESTAMP WITH TIME ZONE NOT NULL,
  items JSONB,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  employee_details JSONB,
  requested_by_id UUID,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_locations (  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID NOT NULL,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  location_id UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (  reporting_manager_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role_id TEXT DEFAULT 'unverified'::text NOT NULL,
  organization_id TEXT,
  organization_name TEXT,
  photo_url TEXT,
  home_latitude NUMERIC(10,7),
  home_longitude NUMERIC(10,7),
  home_address TEXT,
  id UUID NOT NULL
);

-- =============================================
-- TABLES - STORAGE SCHEMA (Managed by Supabase storage engine - omitted to avoid permission denied error)
-- =============================================

-- =============================================
-- PRIMARY KEYS & FOREIGN KEYS (Idempotent execution to prevent dependency/exist conflicts)
-- ============================================= 

DO $$
BEGIN
  -- PRIMARY KEYS
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'app_modules_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.app_modules ADD CONSTRAINT app_modules_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_approvals_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.attendance_approvals ADD CONSTRAINT attendance_approvals_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_events_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comp_off_logs_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.comp_off_logs ADD CONSTRAINT comp_off_logs_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'companies_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'entities_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.entities ADD CONSTRAINT entities_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'extra_work_logs_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.extra_work_logs ADD CONSTRAINT extra_work_logs_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'holidays_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.holidays ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'insurances_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.insurances ADD CONSTRAINT insurances_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leave_requests_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'location_cache_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.location_cache ADD CONSTRAINT location_cache_pkey PRIMARY KEY (latitude, longitude);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'locations_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.locations ADD CONSTRAINT locations_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notifications_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'onboarding_submissions_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.onboarding_submissions ADD CONSTRAINT onboarding_submissions_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'organization_groups_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.organization_groups ADD CONSTRAINT organization_groups_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'organizations_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'policies_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.policies ADD CONSTRAINT policies_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'recurring_holidays_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.recurring_holidays ADD CONSTRAINT recurring_holidays_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'roles_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.roles ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'settings_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'site_configurations_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.site_configurations ADD CONSTRAINT site_configurations_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'site_gents_uniform_configs_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.site_gents_uniform_configs ADD CONSTRAINT site_gents_uniform_configs_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'site_ladies_uniform_configs_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.site_ladies_uniform_configs ADD CONSTRAINT site_ladies_uniform_configs_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'site_staff_designations_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.site_staff_designations ADD CONSTRAINT site_staff_designations_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'site_uniform_details_configs_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.site_uniform_details_configs ADD CONSTRAINT site_uniform_details_configs_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_tickets_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tasks_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ticket_comments_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ticket_posts_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.ticket_posts ADD CONSTRAINT ticket_posts_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'uniform_requests_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.uniform_requests ADD CONSTRAINT uniform_requests_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_locations_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.user_locations ADD CONSTRAINT user_locations_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_pkey' AND table_schema = 'public') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;

  -- FOREIGN KEYS
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_approvals_manager_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.attendance_approvals ADD CONSTRAINT attendance_approvals_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_approvals_user_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.attendance_approvals ADD CONSTRAINT attendance_approvals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_events_location_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_events_user_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comp_off_logs_granted_by_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.comp_off_logs ADD CONSTRAINT comp_off_logs_granted_by_id_fkey FOREIGN KEY (granted_by_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comp_off_logs_leave_request_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.comp_off_logs ADD CONSTRAINT comp_off_logs_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comp_off_logs_user_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.comp_off_logs ADD CONSTRAINT comp_off_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'companies_group_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.organization_groups(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'entities_company_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.entities ADD CONSTRAINT entities_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'extra_work_logs_approver_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.extra_work_logs ADD CONSTRAINT extra_work_logs_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'extra_work_logs_user_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.extra_work_logs ADD CONSTRAINT extra_work_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'leave_requests_user_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'locations_created_by_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.locations ADD CONSTRAINT locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notifications_user_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'onboarding_submissions_created_user_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.onboarding_submissions ADD CONSTRAINT onboarding_submissions_created_user_id_fkey FOREIGN KEY (created_user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'onboarding_submissions_user_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.onboarding_submissions ADD CONSTRAINT onboarding_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_tickets_assigned_to_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'support_tickets_raised_by_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_raised_by_id_fkey FOREIGN KEY (raised_by_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tasks_assigned_to_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'tasks_created_by_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ticket_comments_author_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ticket_comments_post_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.ticket_posts(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ticket_posts_author_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.ticket_posts ADD CONSTRAINT ticket_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ticket_posts_ticket_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.ticket_posts ADD CONSTRAINT ticket_posts_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_locations_location_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.user_locations ADD CONSTRAINT user_locations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_locations_user_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.user_locations ADD CONSTRAINT user_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_reporting_manager_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_role_id_fkey' AND table_schema = 'public') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
  END IF;
END $$;

-- =============================================
-- END OF SCHEMA EXPORT
-- Note: Functions, Triggers, and RLS Policies
-- are extremely long and have been exported.
-- Check the JSON output for the complete list.
-- =============================================
