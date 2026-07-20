import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key] = val.join('=').replace(/["\r\n]/g, '').trim();
  return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: users, error: usersErr } = await supabase.from('users').select('*').ilike('name', '%Nakul%');
  if (usersErr || !users || users.length === 0) {
    console.log('User not found or error:', usersErr);
    
    // Fallback: list users
    const { data: allUsers } = await supabase.from('users').select('id, name, role').limit(20);
    console.log('Some users:', allUsers);
    return;
  }
  const user = users[0];
  console.log(`Found user: ${user.name} (${user.id}) - ${user.role}`);

  const startDate = '2026-01-01';
  const endDate = '2026-07-31';

  const { data: events } = await supabase.from('attendance_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('timestamp', startDate)
    .lte('timestamp', endDate + 'T23:59:59Z');

  const { data: compOffLogs } = await supabase.from('comp_off_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte('date_earned', startDate)
    .lte('date_earned', endDate);
    
  const { data: leaveRequests } = await supabase.from('leave_requests')
    .select('*')
    .eq('user_id', user.id)
    .eq('leave_type', 'Comp Off');

  console.log(`Found ${events?.length || 0} events`);
  console.log(`Found ${compOffLogs?.length || 0} comp off logs`);
  console.log(`Found ${leaveRequests?.length || 0} comp off leave requests`);
  
  if (leaveRequests) {
    console.log('Leave Requests:', leaveRequests.map(lr => `${lr.start_date} to ${lr.end_date} - ${lr.status}`));
  }
  
  fs.writeFileSync('nakul_data.json', JSON.stringify({ events, compOffLogs, leaveRequests }, null, 2));
  console.log("Done");
}

run().catch(console.error);
