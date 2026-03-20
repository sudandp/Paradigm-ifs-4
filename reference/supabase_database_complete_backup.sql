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
-- TABLES - AUTH SCHEMA
-- =============================================

CREATE TABLE IF NOT EXISTS auth.audit_log_entries (  instance_id UUID,
  id UUID NOT NULL,
  ip_address CHARACTER VARYING(64) DEFAULT ''::character varying NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  payload JSON
);

CREATE TABLE IF NOT EXISTS auth.flow_state (  updated_at TIMESTAMP WITH TIME ZONE,
  authentication_method TEXT NOT NULL,
  provider_refresh_token TEXT,
  auth_code_issued_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  code_challenge TEXT NOT NULL,
  user_id UUID,
  id UUID NOT NULL,
  auth_code TEXT NOT NULL,
  code_challenge_method code_challenge_method NOT NULL,
  provider_access_token TEXT,
  provider_type TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.identities (  provider TEXT NOT NULL,
  identity_data JSONB NOT NULL,
  user_id UUID NOT NULL,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  provider_id TEXT NOT NULL,
  email TEXT
);

CREATE TABLE IF NOT EXISTS auth.instances (  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  raw_base_config TEXT,
  id UUID NOT NULL,
  uuid UUID
);

CREATE TABLE IF NOT EXISTS auth.mfa_amr_claims (  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  session_id UUID NOT NULL,
  authentication_method TEXT NOT NULL,
  id UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.mfa_challenges (  factor_id UUID NOT NULL,
  id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  ip_address INET NOT NULL,
  web_authn_session_data JSONB,
  otp_code TEXT
);

CREATE TABLE IF NOT EXISTS auth.mfa_factors (  phone TEXT,
  secret TEXT,
  friendly_name TEXT,
  id UUID NOT NULL,
  status factor_status NOT NULL,
  factor_type factor_type NOT NULL,
  last_webauthn_challenge_data JSONB,
  web_authn_aaguid UUID,
  web_authn_credential JSONB,
  last_challenged_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id UUID NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.oauth_authorizations (  id UUID NOT NULL,
  client_id UUID NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + '00:03:00'::interval) NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  nonce TEXT,
  authorization_code TEXT,
  code_challenge TEXT,
  resource TEXT,
  state TEXT,
  scope TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  authorization_id TEXT NOT NULL,
  response_type oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
  code_challenge_method code_challenge_method,
  status oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.oauth_clients (  logo_uri TEXT,
  client_name TEXT,
  grant_types TEXT NOT NULL,
  redirect_uris TEXT NOT NULL,
  client_secret_hash TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  client_type oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  registration_type oauth_registration_type NOT NULL,
  id UUID NOT NULL,
  client_uri TEXT
);

CREATE TABLE IF NOT EXISTS auth.oauth_consents (  user_id UUID NOT NULL,
  client_id UUID NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  id UUID NOT NULL,
  scopes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.one_time_tokens (  id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  token_type one_time_token_type NOT NULL,
  user_id UUID NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
  relates_to TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (  user_id CHARACTER VARYING(255),
  instance_id UUID,
  id BIGINT DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass) NOT NULL,
  revoked BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  session_id UUID,
  parent CHARACTER VARYING(255),
  token CHARACTER VARYING(255)
);

CREATE TABLE IF NOT EXISTS auth.saml_providers (  sso_provider_id UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  attribute_mapping JSONB,
  id UUID NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_xml TEXT NOT NULL,
  metadata_url TEXT,
  name_id_format TEXT
);

CREATE TABLE IF NOT EXISTS auth.saml_relay_states (  flow_state_id UUID,
  sso_provider_id UUID NOT NULL,
  id UUID NOT NULL,
  redirect_to TEXT,
  for_email TEXT,
  request_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS auth.schema_migrations (  version CHARACTER VARYING(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.sessions (  aal aal_level,
  user_agent TEXT,
  refresh_token_counter BIGINT,
  oauth_client_id UUID,
  ip INET,
  refreshed_at TIMESTAMP WITHOUT TIME ZONE,
  not_after TIMESTAMP WITH TIME ZONE,
  factor_id UUID,
  updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL,
  scopes TEXT,
  id UUID NOT NULL,
  tag TEXT,
  refresh_token_hmac_key TEXT
);

CREATE TABLE IF NOT EXISTS auth.sso_domains (  id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  sso_provider_id UUID NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  domain TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth.sso_providers (  updated_at TIMESTAMP WITH TIME ZONE,
  id UUID NOT NULL,
  resource_id TEXT,
  disabled BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS auth.users (  phone_confirmed_at TIMESTAMP WITH TIME ZONE,
  phone_change_sent_at TIMESTAMP WITH TIME ZONE,
  email_change_token_new CHARACTER VARYING(255),
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_sso_user BOOLEAN DEFAULT false NOT NULL,
  reauthentication_sent_at TIMESTAMP WITH TIME ZONE,
  phone_change TEXT DEFAULT ''::character varying,
  phone TEXT DEFAULT NULL::character varying,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  email_change_confirm_status SMALLINT DEFAULT 0,
  banned_until TIMESTAMP WITH TIME ZONE,
  raw_app_meta_data JSONB,
  email_change CHARACTER VARYING(255),
  aud CHARACTER VARYING(255),
  role CHARACTER VARYING(255),
  recovery_token CHARACTER VARYING(255),
  confirmation_token CHARACTER VARYING(255),
  raw_user_meta_data JSONB,
  is_super_admin BOOLEAN,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  phone_change_token CHARACTER VARYING(255) DEFAULT ''::character varying,
  email_change_sent_at TIMESTAMP WITH TIME ZONE,
  email CHARACTER VARYING(255),
  recovery_sent_at TIMESTAMP WITH TIME ZONE,
  confirmation_sent_at TIMESTAMP WITH TIME ZONE,
  encrypted_password CHARACTER VARYING(255),
  invited_at TIMESTAMP WITH TIME ZONE,
  email_confirmed_at TIMESTAMP WITH TIME ZONE,
  id UUID NOT NULL,
  instance_id UUID,
  email_change_token_current CHARACTER VARYING(255) DEFAULT ''::character varying,
  created_at TIMESTAMP WITH TIME ZONE,
  reauthentication_token CHARACTER VARYING(255) DEFAULT ''::character varying,
  is_anonymous BOOLEAN DEFAULT false NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

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
  gmc_policy JSONB
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
  id UUID NOT NULL
);

-- =============================================
-- TABLES - STORAGE SCHEMA
-- =============================================

CREATE TABLE IF NOT EXISTS storage.buckets (  owner UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  type buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL,
  owner_id TEXT,
  allowed_mime_types _text,
  file_size_limit BIGINT,
  avif_autodetection BOOLEAN DEFAULT false,
  public BOOLEAN DEFAULT false,
  name TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.buckets_analytics (  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  name TEXT NOT NULL,
  format TEXT DEFAULT 'ICEBERG'::text NOT NULL,
  type buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.buckets_vectors (  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  type buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
  id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.migrations (  executed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  hash CHARACTER VARYING(40) NOT NULL,
  id INTEGER NOT NULL,
  name CHARACTER VARYING(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.objects (  name TEXT,
  user_metadata JSONB,
  metadata JSONB,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  owner UUID,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  owner_id TEXT,
  level INTEGER,
  version TEXT,
  path_tokens _text,
  bucket_id TEXT
);

CREATE TABLE IF NOT EXISTS storage.prefixes (  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  bucket_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  name TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads (  owner_id TEXT,
  key TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  version TEXT NOT NULL,
  user_metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  in_progress_size BIGINT DEFAULT 0 NOT NULL,
  upload_signature TEXT NOT NULL,
  id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads_parts (  upload_id TEXT NOT NULL,
  owner_id TEXT,
  id UUID DEFAULT gen_random_uuid() NOT NULL,
  size BIGINT DEFAULT 0 NOT NULL,
  part_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  bucket_id TEXT NOT NULL,
  etag TEXT NOT NULL,
  key TEXT NOT NULL,
  version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS storage.vector_indexes (  data_type TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  id TEXT DEFAULT gen_random_uuid() NOT NULL,
  metadata_configuration JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  distance_metric TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  dimension INTEGER NOT NULL,
  name TEXT NOT NULL
);

-- =============================================
-- PRIMARY KEYS
-- ============================================= 

ALTER TABLE auth.audit_log_entries ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);
ALTER TABLE auth.flow_state ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);
ALTER TABLE auth.identities ADD CONSTRAINT identities_pkey PRIMARY KEY (id);
ALTER TABLE auth.instances ADD CONSTRAINT instances_pkey PRIMARY KEY (id);
ALTER TABLE auth.mfa_amr_claims ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);
ALTER TABLE auth.mfa_challenges ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);
ALTER TABLE auth.mfa_factors ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);
ALTER TABLE auth.oauth_authorizations ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);
ALTER TABLE auth.oauth_clients ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);
ALTER TABLE auth.oauth_consents ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);
ALTER TABLE auth.one_time_tokens ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);
ALTER TABLE auth.refresh_tokens ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);
ALTER TABLE auth.saml_providers ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);
ALTER TABLE auth.saml_relay_states ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);
ALTER TABLE auth.sessions ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
ALTER TABLE auth.sso_domains ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);
ALTER TABLE auth.sso_providers ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);
ALTER TABLE auth.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.app_modules ADD CONSTRAINT app_modules_pkey PRIMARY KEY (id);
ALTER TABLE public.attendance_approvals ADD CONSTRAINT attendance_approvals_pkey PRIMARY KEY (id);
ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_pkey PRIMARY KEY (id);
ALTER TABLE public.comp_off_logs ADD CONSTRAINT comp_off_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
ALTER TABLE public.entities ADD CONSTRAINT entities_pkey PRIMARY KEY (id);
ALTER TABLE public.extra_work_logs ADD CONSTRAINT extra_work_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.holidays ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);
ALTER TABLE public.insurances ADD CONSTRAINT insurances_pkey PRIMARY KEY (id);
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.location_cache ADD CONSTRAINT location_cache_pkey PRIMARY KEY (latitude, longitude);
ALTER TABLE public.locations ADD CONSTRAINT locations_pkey PRIMARY KEY (id);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.onboarding_submissions ADD CONSTRAINT onboarding_submissions_pkey PRIMARY KEY (id);
ALTER TABLE public.organization_groups ADD CONSTRAINT organization_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.organizations ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);
ALTER TABLE public.policies ADD CONSTRAINT policies_pkey PRIMARY KEY (id);
ALTER TABLE public.recurring_holidays ADD CONSTRAINT recurring_holidays_pkey PRIMARY KEY (id);
ALTER TABLE public.roles ADD CONSTRAINT roles_pkey PRIMARY KEY (id);
ALTER TABLE public.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (id);
ALTER TABLE public.site_configurations ADD CONSTRAINT site_configurations_pkey PRIMARY KEY (id);
ALTER TABLE public.site_gents_uniform_configs ADD CONSTRAINT site_gents_uniform_configs_pkey PRIMARY KEY (id);
ALTER TABLE public.site_ladies_uniform_configs ADD CONSTRAINT site_ladies_uniform_configs_pkey PRIMARY KEY (id);
ALTER TABLE public.site_staff_designations ADD CONSTRAINT site_staff_designations_pkey PRIMARY KEY (id);
ALTER TABLE public.site_uniform_details_configs ADD CONSTRAINT site_uniform_details_configs_pkey PRIMARY KEY (id);
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_posts ADD CONSTRAINT ticket_posts_pkey PRIMARY KEY (id);
ALTER TABLE public.uniform_requests ADD CONSTRAINT uniform_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.user_locations ADD CONSTRAINT user_locations_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE storage.buckets ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);
ALTER TABLE storage.buckets_analytics ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);
ALTER TABLE storage.objects ADD CONSTRAINT objects_pkey PRIMARY KEY (id);
ALTER TABLE storage.prefixes ADD CONSTRAINT prefixes_pkey PRIMARY KEY (name, bucket_id, level);
ALTER TABLE storage.s3_multipart_uploads ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);
ALTER TABLE storage.s3_multipart_uploads_parts ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);

-- =============================================
-- FOREIGN KEYS
-- =============================================

ALTER TABLE public.attendance_approvals ADD CONSTRAINT attendance_approvals_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE public.attendance_approvals ADD CONSTRAINT attendance_approvals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE public.attendance_events ADD CONSTRAINT attendance_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.comp_off_logs ADD CONSTRAINT comp_off_logs_granted_by_id_fkey FOREIGN KEY (granted_by_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.comp_off_logs ADD CONSTRAINT comp_off_logs_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.comp_off_logs ADD CONSTRAINT comp_off_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.companies ADD CONSTRAINT companies_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.organization_groups(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.entities ADD CONSTRAINT entities_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.extra_work_logs ADD CONSTRAINT extra_work_logs_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.extra_work_logs ADD CONSTRAINT extra_work_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.locations ADD CONSTRAINT locations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.onboarding_submissions ADD CONSTRAINT onboarding_submissions_created_user_id_fkey FOREIGN KEY (created_user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.onboarding_submissions ADD CONSTRAINT onboarding_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_raised_by_id_fkey FOREIGN KEY (raised_by_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE NO ACTION;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.ticket_comments ADD CONSTRAINT ticket_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.ticket_posts(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.ticket_posts ADD CONSTRAINT ticket_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.ticket_posts ADD CONSTRAINT ticket_posts_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.user_locations ADD CONSTRAINT user_locations_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.user_locations ADD CONSTRAINT user_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES public.users(id) ON UPDATE NO ACTION ON DELETE SET NULL;
ALTER TABLE public.users ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE NO ACTION ON DELETE NO ACTION;

-- =============================================
-- END OF SCHEMA EXPORT
-- Note: Functions, Triggers, and RLS Policies
-- are extremely long and have been exported.
-- Check the JSON output for the complete list.
-- =============================================
