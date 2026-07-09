import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sql = `
create or replace function approve_user(user_id uuid, role_text text)
returns void
language plpgsql
security definer
as $$
declare
  is_admin boolean;
  new_joining_date date;
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
`;

async function tryRPC(name: string, params: any): Promise<boolean> {
    console.log(`Trying RPC: ${name} with params:`, Object.keys(params));
    try {
        const { data, error } = await supabase.rpc(name, params);
        if (error) {
            console.log(`  RPC ${name} failed:`, error.message);
            return false;
        }
        console.log(`  RPC ${name} SUCCEEDED!`);
        return true;
    } catch (err: any) {
        console.log(`  RPC ${name} exception:`, err.message || err);
        return false;
    }
}

async function main() {
    const strategies = [
        { name: 'exec_sql', params: { sql } },
        { name: 'exec_sql', params: { sql_query: sql } },
        { name: 'exec_sql', params: { query: sql } },
        { name: 'execute_sql', params: { sql } },
        { name: 'execute_sql', params: { sql_query: sql } },
        { name: 'run_sql', params: { sql } },
        { name: 'run_sql', params: { sql_query: sql } },
    ];
    
    let success = false;
    for (const strategy of strategies) {
        success = await tryRPC(strategy.name, strategy.params);
        if (success) break;
    }
    
    if (success) {
        console.log("Successfully updated the approve_user RPC function in database!");
    } else {
        console.error("All SQL RPC attempts failed.");
    }
}

main().catch(console.error);
