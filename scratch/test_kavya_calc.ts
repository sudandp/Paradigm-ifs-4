import { createClient } from '@supabase/supabase-js';
import { processEmployeeMonth } from '../utils/monthlyReportCalculations';

const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(v => toCamelCase(v));
  if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
      result[camelKey] = toCamelCase(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
};

const admin = createClient('https://fmyafuhxlorbafbacywa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M');

async function testKavyaMonth() {
  const { data: users } = await admin.from('users').select('*');
  const kavya = users?.find(u => u.name === 'Kavya M');
  if (!kavya) { console.log('Kavya M not found'); return; }

  const { data: leaves } = await admin.from('leave_requests').select('*').eq('user_id', kavya.id);
  const camelLeaves = (leaves || []).map(toCamelCase);

  const { data: events } = await admin.from('attendance_events').select('*').eq('user_id', kavya.id).gte('timestamp', '2026-07-15').lte('timestamp', '2026-09-05');
  const camelEvents = (events || []).map(toCamelCase);

  const { data: attSettings } = await admin.from('attendance_settings').select('*').single();
  const settings = attSettings?.rules || {};

  const { data: holidays } = await admin.from('global_holidays').select('*');
  const officeHolidays = (holidays || []).filter((h: any) => h.type === 'office');
  const recurringHolidays = settings.office?.recurringHolidays || [{ day: 'Saturday', n: 3, type: 'office' }];

  const result = processEmployeeMonth(
    toCamelCase(kavya),
    camelEvents,
    camelLeaves,
    [],
    2026,
    8,
    officeHolidays,
    [],
    [],
    recurringHolidays,
    camelLeaves,
    'hr_ops',
    [],
    null,
    settings,
    []
  );

  console.log('Result for Kavya M in Aug 2026:');
  console.log('Statuses:', result.statuses);
  result.dailyData.forEach(d => {
    console.log(`Day ${d.date}: status="${d.status}", in="${d.inTime}", out="${d.outTime}", gross="${d.grossDuration}", net="${d.netWorkedHours}", perm="${d.permDuration}"`);
  });
  console.log('Summary stats:', {
    presentDays: result.presentDays,
    halfDays: result.halfDays,
    absentDays: result.absentDays,
    weekOffs: result.weekOffs,
    holidays: result.holidays,
    earnedLeaves: result.earnedLeaves,
    sickLeaves: result.sickLeaves,
    casualLeaves: result.casualLeaves,
    floatingHolidays: result.floatingHolidays,
    compOffs: result.compOffs,
    totalPayableDays: result.totalPayableDays
  });
}

testKavyaMonth().catch(console.error);
