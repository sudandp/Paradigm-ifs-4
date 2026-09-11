import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'e:/backup/onboarding all files/Paradigm Office 4/.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = '5321c6f6-578e-4168-9da8-060148e1587b';

async function generateTracker() {
  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
  const { data: leaves } = await supabase.from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['approved', 'pending_manager_approval', 'pending_hr_confirmation'])
    .order('start_date', { ascending: true });

  const earnedLeaves = (leaves || []).filter(l => (l.leave_type || '').toLowerCase().includes('earned'));
  const compOffLeaves = (leaves || []).filter(l => (l.leave_type || '').toLowerCase().includes('comp'));

  console.log('USER_PROFILE:', JSON.stringify({
    name: user.name,
    email: user.email,
    joiningDate: user.joining_date,
    createdAt: user.created_at,
    elOpeningBal: user.earned_leave_opening_balance,
    elOpeningDate: user.earned_leave_opening_date,
  }));

  console.log('\n--- EARNED LEAVES TAKEN ---');
  let total = 0;
  earnedLeaves.forEach((l, idx) => {
    let days = l.day_option === 'half' ? 0.5 : 1;
    if (l.start_date !== l.end_date && l.day_option !== 'half') {
      const d1 = new Date(l.start_date);
      const d2 = new Date(l.end_date);
      days = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    }
    total += days;
    console.log(JSON.stringify({
      num: idx + 1,
      dates: l.start_date === l.end_date ? l.start_date : (l.start_date + ' to ' + l.end_date),
      days,
      cumTaken: total,
      option: l.day_option || 'full',
      reason: l.reason,
      status: l.status,
      id: l.id
    }));
  });

  console.log('\n--- COMP OFF RECORD FOR 2026-02-24 ---');
  compOffLeaves.filter(c => c.start_date === '2026-02-24').forEach(c => {
    console.log(JSON.stringify({
      dates: c.start_date,
      reason: c.reason,
      createdAt: c.created_at,
      status: c.status,
      id: c.id
    }));
  });
}
generateTracker();
