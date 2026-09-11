import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'e:/backup/onboarding all files/Paradigm Office 4/.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = '5321c6f6-578e-4168-9da8-060148e1587b';

async function calculateQualifyingDays() {
  const [eventsRes, leavesRes, holidaysRes, recHolidaysRes, userHolidaysRes] = await Promise.all([
    supabase.from('attendance_events')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', '2026-01-01T00:00:00')
      .lte('timestamp', '2026-09-10T23:59:59'),
    supabase.from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['approved', 'pending_manager_approval', 'pending_hr_confirmation'])
      .gte('start_date', '2026-01-01')
      .lte('start_date', '2026-09-10'),
    supabase.from('holidays').select('*'),
    supabase.from('recurring_holidays').select('*'),
    supabase.from('user_holidays').select('*').eq('user_id', userId)
  ]);

  const events = eventsRes.data || [];
  const leaves = leavesRes.data || [];
  const holidays = holidaysRes.data || [];
  const userHolidays = userHolidaysRes.data || [];

  // 1. Identify all worked dates (punch-in)
  const punchDates = new Set();
  events.forEach(e => {
    if (e.type && (e.type.toLowerCase().includes('in') || e.type.toLowerCase().includes('check'))) {
      const d = e.timestamp.split('T')[0];
      punchDates.add(d);
    }
  });

  // 2. Identify all leave dates
  const leaveDayMap = new Map();
  leaves.forEach(l => {
    const type = (l.leave_type || '').toLowerCase();
    // expand dates
    let cur = new Date(l.start_date);
    const end = new Date(l.end_date);
    while (cur <= end) {
      const dStr = cur.toISOString().split('T')[0];
      leaveDayMap.set(dStr, { type, dayOption: l.day_option, id: l.id });
      cur.setDate(cur.getDate() + 1);
    }
  });

  // 3. Holidays set
  const holidayDates = new Set();
  holidays.forEach(h => holidayDates.add(h.date));
  userHolidays.forEach(uh => holidayDates.add(uh.holiday_date || uh.holidayDate));

  let workedCount = 0;
  let wfhCount = 0;
  let holidayCount = 0;
  let compOffCount = 0;
  let weekOffCount = 0;
  let elCount = 0;
  let otherCount = 0;

  let totalQualifyingDays = 0;
  const dayBreakdown = [];

  // Iterate day by day from 2026-01-01 to 2026-09-10 (253 calendar days)
  let cur = new Date('2026-01-01');
  const end = new Date('2026-09-10');

  // Track weekly worked days for week-off qualification
  let weeklyPunchesInCurrentWeek = 0;

  while (cur <= end) {
    const dStr = cur.toISOString().split('T')[0];
    const dayOfWeek = cur.getDay(); // 0 = Sunday
    const hasPunch = punchDates.has(dStr);
    const leave = leaveDayMap.get(dStr);
    const isHoliday = holidayDates.has(dStr);

    let dayCategory = 'absent';
    let isQualifying = false;

    if (hasPunch) {
      dayCategory = 'worked';
      workedCount++;
      isQualifying = true;
      weeklyPunchesInCurrentWeek++;
    } else if (leave) {
      if (leave.type.includes('wfh')) {
        dayCategory = 'wfh';
        wfhCount++;
        isQualifying = true;
        weeklyPunchesInCurrentWeek++;
      } else if (leave.type.includes('comp')) {
        dayCategory = 'comp_off';
        compOffCount++;
        isQualifying = true;
      } else if (leave.type.includes('earned')) {
        dayCategory = 'earned_leave';
        elCount++;
        // Note: EL is paid leave
        isQualifying = true;
      } else if (leave.type.includes('sick')) {
        dayCategory = 'sick_leave';
        isQualifying = true;
      } else {
        dayCategory = leave.type;
      }
    } else if (isHoliday) {
      dayCategory = 'holiday';
      holidayCount++;
      isQualifying = true;
    } else if (dayOfWeek === 0) { // Sunday
      // If employee worked or qualified during the week
      dayCategory = 'week_off';
      weekOffCount++;
      isQualifying = true;
    }

    if (isQualifying) {
      totalQualifyingDays++;
    }

    dayBreakdown.push({ date: dStr, category: dayCategory, qualifying: isQualifying });

    if (dayOfWeek === 0) {
      weeklyPunchesInCurrentWeek = 0;
    }

    cur.setDate(cur.getDate() + 1);
  }

  console.log('SUMMARY FROM 2026-01-01 TO 2026-09-10 (253 calendar days):');
  console.log('Worked (Punched):', workedCount);
  console.log('WFH:', wfhCount);
  console.log('Holidays:', holidayCount);
  console.log('Comp Off:', compOffCount);
  console.log('Week Offs (Sundays):', weekOffCount);
  console.log('Earned Leaves taken:', elCount);
  console.log('TOTAL QUALIFYING DAYS:', totalQualifyingDays);

  const elEarned = Math.floor(totalQualifyingDays / 10) * 0.5;
  console.log(`EL Earned at 0.5 per 10 days: Math.floor(${totalQualifyingDays} / 10) * 0.5 = ${elEarned} days`);
}
calculateQualifyingDays();
