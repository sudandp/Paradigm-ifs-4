import { createClient } from './node_modules/@supabase/supabase-js/dist/main/index.js';
import dotenv from './node_modules/dotenv/lib/main.js';
import { format } from './node_modules/date-fns/index.js';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = '5321c6f6-578e-4168-9da8-060148e1587b';

async function calculateMonthlyAndMilestones() {
  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
  const { data: events } = await supabase.from('attendance_events').select('*').eq('user_id', userId).gte('timestamp', '2026-01-01T00:00:00Z').lte('timestamp', '2026-12-31T23:59:59Z');
  const { data: leaves } = await supabase.from('leave_requests').select('*').eq('user_id', userId).in('status', ['approved', 'correction_made']);
  const { data: holidays } = await supabase.from('holidays').select('*');
  const { data: userHolidays } = await supabase.from('user_holidays').select('*').eq('user_id', userId);

  const attendedDates = new Set();
  (events || []).forEach(e => {
    if (['punch-in', 'site-in', 'check-in', 'site-ot-in'].includes((e.type || '').toLowerCase())) {
      attendedDates.add(e.timestamp.split('T')[0]);
    }
  });

  const holidayDates = new Set();
  (holidays || []).forEach(h => holidayDates.add(h.date));
  (userHolidays || []).forEach(h => holidayDates.add(h.date));

  const openingDate = user.earned_leave_opening_date || '2026-01-01';
  const openingBalance = Number(user.earned_leave_opening_balance || 0);

  const cur = new Date(openingDate.replace(/-/g, '/'));
  const today = new Date('2026-09-10');

  let totalQualifying = 0;
  let weekWorkDays = 0;

  const milestones = [];
  const monthlyMap = {};

  while (cur <= today) {
    const dStr = format(cur, 'yyyy-MM-dd');
    const mStr = format(cur, 'yyyy-MM');
    const dow = cur.getDay();

    if (!monthlyMap[mStr]) {
      monthlyMap[mStr] = { month: format(cur, 'MMMM yyyy'), monthKey: mStr, qualifyingDays: 0, accrued: 0, workedDays: 0, holidays: 0, sundays: 0, leaves: 0 };
    }

    const hasPunch = attendedDates.has(dStr);
    const dayLeave = (leaves || []).find(l => dStr >= l.start_date && dStr <= l.end_date);
    const lType = dayLeave ? (dayLeave.leave_type || '').toLowerCase() : '';
    const isHoliday = holidayDates.has(dStr);

    let isQualifying = false;

    if (hasPunch || lType.includes('wfh')) {
      isQualifying = true;
      weekWorkDays++;
      monthlyMap[mStr].workedDays++;
    } else if (isHoliday) {
      isQualifying = true;
      weekWorkDays++;
      monthlyMap[mStr].holidays++;
    } else if (lType.includes('comp') || lType.includes('earned') || lType.includes('sick')) {
      isQualifying = true;
      weekWorkDays++;
      monthlyMap[mStr].leaves++;
    } else if (dow === 0) {
      if (weekWorkDays >= 4) {
        isQualifying = true;
        monthlyMap[mStr].sundays++;
      }
    }

    if (isQualifying) {
      totalQualifying++;
      monthlyMap[mStr].qualifyingDays++;

      if (totalQualifying % 10 === 0) {
        milestones.push({
          milestoneNumber: totalQualifying / 10,
          dateReached: dStr,
          qualifyingDays: totalQualifying,
          credit: 0.5,
          cumulativeAccrued: Math.round((openingBalance + (totalQualifying * 0.05)) * 10) / 10
        });
      }
    }

    if (dow === 0) {
      weekWorkDays = 0;
    }

    cur.setDate(cur.getDate() + 1);
  }

  let cumAccrued = openingBalance;
  Object.values(monthlyMap).forEach(m => {
    m.accrued = Math.round(m.qualifyingDays * 0.05 * 10) / 10;
    cumAccrued = Math.round((cumAccrued + m.accrued) * 10) / 10;
    m.cumulativeAccrued = cumAccrued;
  });

  console.log('Total Qualifying Days:', totalQualifying);
  console.log('Total Accrued:', Math.round((openingBalance + totalQualifying * 0.05) * 10) / 10);
  console.log('\n--- MONTHLY ACCRUAL BREAKUP ---');
  console.table(Object.values(monthlyMap));

  console.log('\n--- 10-DAY MILESTONES (EARNED BREAKUP) ---');
  console.table(milestones);
}

calculateMonthlyAndMilestones();
