-- ============================================================================
-- Migration: 20260919_offline_first_triggers_rls_storage.sql (Hardened v2)
-- Work Item: W2 (Server-Side Verification & Hardening for Offline-First Sync)
-- Target: Staging and Production Supabase DB
-- Description:
--   0. Self-contained Table Creation (CREATE TABLE IF NOT EXISTS for ppm_executions & client_sync_events).
--   1. Universal `set_updated_at()` trigger for optimistic concurrency & conflict detection.
--   2. Client revision token (`client_revision uuid`) for retry-safe conflict detection.
--   3. Optimized Role helper functions with (select fn()) using verified users.role_id values.
--   4. Scoped table policies on operations tables (admin-only delete).
--   5. Folder-scoped storage policies with privacy protection for onboarding-documents.
--   6. Client sync events table for W9 telemetry & observability.
-- ============================================================================

begin;

-- ============================================================================
-- B0. Ensure required tables exist before ALTER TABLE
-- ============================================================================
create table if not exists public.ppm_executions (
    id uuid primary key default gen_random_uuid(),
    site_name text not null,
    reference_number text not null,
    category_id text not null,
    audit_date date not null,
    client_division text,
    status text not null default 'DRAFT' check (status in ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWED')),
    auditor_name text,
    organization_id uuid,
    observations jsonb not null default '{}'::jsonb,
    summary_counts jsonb not null default '{}'::jsonb,
    snag_ids jsonb not null default '[]'::jsonb,
    photo_urls jsonb not null default '[]'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    client_revision uuid
);

create index if not exists idx_ppm_executions_site on public.ppm_executions(site_name);
create index if not exists idx_ppm_executions_status on public.ppm_executions(status);
create index if not exists idx_ppm_executions_category on public.ppm_executions(category_id);

create table if not exists public.client_sync_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  table_name text,
  record_id text,
  error_kind text,
  error_code text,
  queue_age_s int,
  app_version text,
  platform text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- B1. updated_at columns and universal trigger
-- ============================================================================
alter table public.snag_audits    add column if not exists updated_at timestamptz default now();
alter table public.ppm_executions add column if not exists updated_at timestamptz default now();
alter table public.ht_yard_audits add column if not exists updated_at timestamptz default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at on public.snag_audits;
create trigger trg_set_updated_at before insert or update on public.snag_audits
for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.ppm_executions;
create trigger trg_set_updated_at before insert or update on public.ppm_executions
for each row execute function public.set_updated_at();

drop trigger if exists trg_set_updated_at on public.ht_yard_audits;
create trigger trg_set_updated_at before insert or update on public.ht_yard_audits
for each row execute function public.set_updated_at();

-- ============================================================================
-- B2. Retry-safe conflict detection token (fresh uuid per client save)
-- ============================================================================
alter table public.ht_yard_audits add column if not exists client_revision uuid;
alter table public.ppm_executions add column if not exists client_revision uuid;
alter table public.snag_audits    add column if not exists client_revision uuid;

-- ============================================================================
-- B3. Role helpers (SECURITY DEFINER avoids RLS recursion on public.users)
--     Uses role_id column and exact staging roles.
-- ============================================================================
create or replace function public.is_ops_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role_id in (
        'admin', 'director', 'admin_manager',
        'operation_manager', 'site_manager', 'technical_manager',
        'field_staff', 'field_officer', 'technical_supervisor', 'technical_reliever',
        'auditor', 'technician', 'electrician', 'plumber', 'hvac_technician'
      )
  );
$$;

create or replace function public.is_admin_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role_id in ('admin', 'director', 'admin_manager')
  );
$$;

create or replace function public.is_onboarding_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role_id in ('admin', 'director', 'admin_manager', 'hr', 'hr_ops', 'hr_onboaring', 'hr_recruitment')
  );
$$;

revoke all on function public.is_ops_user()          from public;
revoke all on function public.is_admin_user()        from public;
revoke all on function public.is_onboarding_staff()  from public;
grant execute on function public.is_ops_user()          to authenticated;
grant execute on function public.is_admin_user()        to authenticated;
grant execute on function public.is_onboarding_staff()  to authenticated;

-- ============================================================================
-- B4. Table policies (operations tables). Delete is admin-only.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['snag_audits','ppm_executions','ht_yard_audits'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('drop policy if exists %I on public.%I', 'Allow authenticated read '  || t, t);
    execute format('drop policy if exists %I on public.%I', 'Allow authenticated write ' || t, t);

    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_ops_user()))',
                   t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_ops_user()))',
                   t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_ops_user())) with check ((select public.is_ops_user()))',
                   t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_admin_user()))',
                   t || '_delete', t);
  end loop;
end $$;

-- ============================================================================
-- B5. Storage (Folder-scoped, drops original migration bucket-wide policies)
--     Path convention: <userId>/<table>/<recordId>/<key>.<ext>
-- ============================================================================

-- B5.1 Check active buckets
do $$
declare b text;
begin
  foreach b in array array['onboarding-documents','ht-yard-photos'] loop
    if not exists (select 1 from storage.buckets where id = b) then
      raise exception 'Bucket "%" does not exist. Confirm the bucket name used in the code before applying.', b;
    end if;
    if (select public from storage.buckets where id = b) then
      raise warning 'Bucket "%" is PUBLIC: files are readable by URL with no login, and storage RLS does not apply to those reads.', b;
    end if;
  end loop;
end $$;

-- B5.2 Remove ORIGINAL migration's bucket-wide policies (prevent OR-bypass)
drop policy if exists "offline_storage_onboarding_insert" on storage.objects;
drop policy if exists "offline_storage_onboarding_update" on storage.objects;
drop policy if exists "offline_storage_onboarding_select" on storage.objects;
drop policy if exists "offline_storage_ht_photos_insert"  on storage.objects;
drop policy if exists "offline_storage_ht_photos_update"  on storage.objects;
drop policy if exists "offline_storage_ht_photos_select"  on storage.objects;

-- B5.3 Folder-scoped policies on active buckets
do $$
declare
  b text;
  read_check text;
begin
  foreach b in array array['onboarding-documents','ht-yard-photos'] loop
    execute format('drop policy if exists %I on storage.objects', 'offline_storage_' || b || '_insert');
    execute format('drop policy if exists %I on storage.objects', 'offline_storage_' || b || '_update');
    execute format('drop policy if exists %I on storage.objects', 'offline_storage_' || b || '_select');

    if b = 'onboarding-documents' then
      -- Candidate identity documents restricted to uploader or HR/Admin staff only
      read_check := '(storage.foldername(name))[1] = auth.uid()::text or (select public.is_onboarding_staff())';
    else
      -- Audit photos readable by uploader or any operations staff
      read_check := '(storage.foldername(name))[1] = auth.uid()::text or (select public.is_ops_user())';
    end if;

    execute format($p$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$,
      'offline_storage_' || b || '_insert', b);

    execute format($p$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$,
      'offline_storage_' || b || '_update', b, b);

    execute format($p$create policy %I on storage.objects for select to authenticated
      using (bucket_id = %L and (%s))$p$,
      'offline_storage_' || b || '_select', b, read_check);
  end loop;
end $$;

-- ============================================================================
-- B6. Sync-event log
-- ============================================================================
alter table public.client_sync_events alter column record_id type text using record_id::text;
alter table public.client_sync_events enable row level security;

drop policy if exists "client_sync_events_insert_own" on public.client_sync_events;
create policy "client_sync_events_insert_own" on public.client_sync_events
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "client_sync_events_select_admin" on public.client_sync_events;
create policy "client_sync_events_select_admin" on public.client_sync_events
  for select to authenticated using (user_id = auth.uid() or (select public.is_admin_user()));

commit;
