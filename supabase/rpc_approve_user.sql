-- Function to approve a user by confirming their email and setting their role
-- This replaces the admin-approve-user Edge Function which failed to deploy.

create or replace function approve_user(user_id uuid, role_text text)
returns void
language plpgsql
security definer
as $$
declare
  is_admin boolean;
begin
  -- Check if the executing user has admin privileges
  -- Allowed roles: admin, super_admin, superadmin
  -- We assume the 'auth.uid()' is the current user's ID
  select exists (
    select 1
    from public.users
    where id = auth.uid()
    and role_id in ('admin', 'super_admin', 'superadmin')
  ) into is_admin;

  if not is_admin then
    raise exception 'Access denied: Only admins can approve users.';
  end if;

  -- 1. Confirm the user's email in auth.users
  -- This allows them to login without clicking the email link
  update auth.users
  set email_confirmed_at = now(),
      updated_at = now()
  where id = user_id;

  -- 2. Update the user's role in public.users
  update public.users
  set role_id = role_text,
      updated_at = now()
  where id = user_id;
end;
$$;
