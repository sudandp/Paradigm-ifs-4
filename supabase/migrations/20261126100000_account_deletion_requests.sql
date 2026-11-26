-- Account deletion (Apple Guideline 5.1.1(v), Google Play User Data / Account Deletion policy).
-- Audit trail for self-service deletions performed by the `delete-account` edge function.
-- Statutory employment records (attendance, payroll, statutory registers) are retained under
-- labour-law obligations; the login and personal profile fields are removed/anonymised.

create table if not exists public.account_deletion_requests (
    id            uuid primary key default gen_random_uuid(),
    user_id       uuid not null,
    email         text,
    reason        text,
    status        text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
    error         text,
    requested_at  timestamptz not null default now(),
    completed_at  timestamptz
);

create index if not exists account_deletion_requests_user_idx
    on public.account_deletion_requests (user_id);

-- Only the service role (edge function) reads or writes this table.
alter table public.account_deletion_requests enable row level security;
