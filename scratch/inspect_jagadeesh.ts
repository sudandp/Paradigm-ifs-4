import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { api } from '../services/api';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('email', 'saijagadeesh9618@gmail.com')
    .single();

  if (userErr || !user) {
    console.error('User not found:', userErr?.message);
    return;
  }

  console.log('User found:', user);

  // Get leave balances
  const balance = await api.getLeaveBalancesForUser(user.id);
  console.log('Leave Balances:', JSON.stringify(balance, null, 2));

  // Get comp off logs
  const { data: compOffLogs } = await supabase
    .from('comp_off_logs')
    .select('*')
    .eq('user_id', user.id);
  
  console.log('Comp Off Logs:', compOffLogs);
  
  // Get leave requests
  const { data: leaves } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', user.id);

  console.log('Leave Requests:', leaves);
}

main().catch(console.error);
