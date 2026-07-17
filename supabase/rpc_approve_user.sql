-- Function to approve a user by confirming their email and setting their role
-- This replaces the admin-approve-user Edge Function which failed to deploy.

create or replace function approve_user(user_id uuid, role_text text)
returns void
language plpgsql
security definer
as $$
declare
  is_admin boolean;
  new_joining_date date;
begin
  -- Check if the executing user has 'manage_users' permission or admin privileges
  select exists (
    select 1
    from public.users u
    left join public.roles r on u.role_id = r.id
    where u.id = auth.uid()
    and (
      'manage_users' = any(r.permissions)
      or u.role_id in ('admin', 'super_admin', 'superadmin', 'developer')
    )
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

  -- 2. Fetch or compute the joining date
  select coalesce(joining_date, current_date)
  into new_joining_date
  from public.users
  where id = user_id;

  -- 3. Update the user's role, joining date, and leave balance opening dates in public.users
  update public.users
  set role_id = role_text,
      joining_date = new_joining_date,
      earned_leave_opening_date = coalesce(earned_leave_opening_date, new_joining_date),
      sick_leave_opening_date = coalesce(sick_leave_opening_date, new_joining_date),
      comp_off_opening_date = coalesce(comp_off_opening_date, new_joining_date),
      floating_leave_opening_date = coalesce(floating_leave_opening_date, new_joining_date),
      child_care_leave_opening_date = coalesce(child_care_leave_opening_date, new_joining_date),
      updated_at = now()
  where id = user_id;
end;
$$;
