import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectLeaves() {
  console.log("Fetching leave requests...");
  const { data: leaves, error } = await supabase
    .from('leave_requests')
    .select(`
      id,
      user_id,
      leave_type,
      start_date,
      end_date,
      status,
      reason,
      day_option,
      users!leave_requests_user_id_fkey(name)
    `)
    .eq('status', 'approved');

  if (error) {
    console.error('Error fetching leaves:', error);
    return;
  }

  console.log(`Found ${leaves?.length || 0} approved leave requests.`);

  const healthKeywords = ['health', 'fever', 'sick', 'hospital', 'bp', 'medical', 'not good', 'not well', 'low bp'];
  const matches = leaves?.filter(leave => {
    const reason = (leave.reason || '').toLowerCase();
    const matchesKeyword = healthKeywords.some(kw => reason.includes(kw));
    const isLOP = (leave.leave_type || '').toLowerCase().includes('loss') || (leave.leave_type || '').toLowerCase().includes('lop');
    return matchesKeyword && isLOP;
  });

  console.log("\nMatching LOP leaves with health reasons:");
  matches?.forEach(m => {
    console.log(`- ID: ${m.id}`);
    console.log(`  User: ${m.users?.name} (${m.user_id})`);
    console.log(`  Leave Type: ${m.leave_type}`);
    console.log(`  Dates: ${m.start_date} to ${m.end_date}`);
    console.log(`  Reason: ${m.reason}`);
    console.log(`  Day Option: ${m.day_option}`);
  });
}

inspectLeaves();
