import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const userId = '216d264d-b20b-45a1-91b5-09cb47c781fb'; // Veerabhadra T M

  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
  const { data: leaves } = await supabase.from('leave_requests').select('*').eq('user_id', userId).in('status', ['approved', 'pending_manager_approval', 'pending_hr_confirmation']);

  console.log("User Profile in DB:", {
    name: user.name,
    comp_off_opening_balance: user.comp_off_opening_balance,
    comp_off_opening_date: user.comp_off_opening_date
  });

  const compOffLeaves = leaves?.filter(l => l.leave_type === 'Comp Off') || [];
  console.log("Comp Off Leaves in DB count:", compOffLeaves.length);

  let approvedUsed = 0;
  let pendingUsed = 0;

  compOffLeaves.forEach(l => {
    const s = new Date(l.start_date);
    const e = new Date(l.end_date);
    const days = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const count = l.days_count || l.total_days || (l.day_option === 'half' ? 0.5 : days);
    if (l.status === 'approved') approvedUsed += count;
    else pendingUsed += count;
  });

  console.log(`Approved Comp Off Taken: ${approvedUsed}`);
  console.log(`Pending Comp Off Taken: ${pendingUsed}`);

  const totalEarned = (user.comp_off_opening_balance || 0);
  const netAvailable = totalEarned - approvedUsed - pendingUsed;

  console.log(`Calculated Total Earned: ${totalEarned}`);
  console.log(`Calculated Net Available: ${netAvailable}`);
}

test().catch(console.error);
