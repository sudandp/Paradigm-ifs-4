import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { format } from 'date-fns';
import { evaluateAttendanceStatus, isBangaloreLocation, getStaffCategory } from '../utils/attendanceCalculations';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);



async function check() {
  // Fetch users, holidays, settings, events, leaves
  const [usersRes, settingsRes, holidaysRes, recurringHolidaysRes, leavesRes, eventsRes] = await Promise.all([
    supabase.from('users').select('id, name, email, role_id, gender, society_id, society_name, organization_name, companies!users_society_id_fkey(location)'),
    supabase.from('settings').select('attendance_settings').eq('id', 'singleton').single(),
    supabase.from('holidays').select('*'),
    supabase.from('recurring_holidays').select('*'),
    supabase.from('leave_requests').select('*').eq('status', 'approved'),
    supabase.from('attendance_events').select('*').gte('timestamp', '2026-06-15T00:00:00Z').lte('timestamp', '2026-06-23T23:59:59Z')
  ]);

  if (usersRes.error) {
    console.error('Error fetching users:', usersRes.error.message);
    return;
  }

  const users = (usersRes.data || []).map((u: any) => {
    const companies = u.companies;
    const compLocation = Array.isArray(companies) ? companies[0]?.location : companies?.location;
    return {
      ...u,
      location: compLocation
    };
  });
  const settings = settingsRes.data?.attendance_settings || {};
  const holidays = holidaysRes.data || [];
  const recurringHolidays = (recurringHolidaysRes.data || []).map(row => ({
    id: row.id,
    type: row.role_type,
    day: row.day,
    n: row.occurrence,
    eligibleRoles: Array.isArray(row.eligible_roles) ? row.eligible_roles : []
  }));
  const leaves = leavesRes.data || [];
  const events = eventsRes.data || [];
  
  const uniqueSocieties = Array.from(new Set(users.map(u => u.society_name).filter(Boolean)));
  console.log('Unique society names:', uniqueSocieties);

  const targetDate = new Date('2026-06-20T12:00:00'); // Saturday, June 20, 2026

  const results = users.map(user => {
    const roleName = user.role_id || '';
    const category = getStaffCategory(roleName, user.society_id, settings);
    const rules = settings[category] || {};

    const userLocation = user.location || (user as any).location_name || user.organization_name || user.society_name;
    const isBang = isBangaloreLocation(userLocation);
    const isBangStaff = isBang && (category === 'office' || category === 'field');

    if (user.name.includes('Arjun') || user.name.includes('Naidu') || user.name.includes('Devani') || user.name.includes('Veerendra') || user.name.includes('Jagadeesh')) {
      console.log(`User: ${user.name}, Location: ${userLocation}, Gender: ${user.gender}, Category: ${category}, isBangStaff: ${isBangStaff}`);
    }

    let dayEvents = events.filter(e => e.user_id === user.id && format(new Date(e.timestamp), 'yyyy-MM-dd') === '2026-06-20');
    
    // Simulate check-in for Jagadeesh
    if (user.email === 'saijagadeesh9618@gmail.com') {
      dayEvents = [
        { id: 'mock-1', user_id: user.id, timestamp: '2026-06-20T09:00:00Z', type: 'punch-in' },
        { id: 'mock-2', user_id: user.id, timestamp: '2026-06-20T18:00:00Z', type: 'punch-out' }
      ] as any;
    }

    // Simple calculation for netHours
    const netHours = dayEvents.length > 0 ? 8 : 0; // simulated

    const status = evaluateAttendanceStatus({
      day: targetDate,
      userId: user.id,
      userCategory: category,
      userRole: roleName,
      userRules: rules,
      dayEvents,
      officeHolidays: holidays,
      fieldHolidays: holidays,
      siteHolidays: holidays,
      recurringHolidays,
      userHolidaysPool: [],
      leaves,
      daysPresentInWeek: 5, // mock eligible
      isActiveInPreviousWeek: true, // mock eligible
      workingHours: netHours,
      fieldStatus: '',
      floatingHolidayMonths: rules.floatingHolidayMonths,
      userGender: user.gender,
      userLocation
    });

    return {
      name: user.name,
      gender: user.gender,
      location: userLocation,
      category,
      status,
      eventsCount: dayEvents.length
    };
  });

  // Print some non-A results or a summary
  const summary = results.reduce((acc: any, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Status Summary on June 20th:', summary);
  console.log('\nSample users showing W/O, BL, PL or P:');
  console.log(results.filter(r => r.status !== 'A').slice(0, 20));
}

check();
