import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { processEmployeeMonth } from '../utils/monthlyReportCalculations';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27'; // Arpitha Nairy

// Helper to convert object keys to camelCase
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v));
  } else if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce(
      (result, key) => ({
        ...result,
        [key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())]: toCamelCase(obj[key]),
      }),
      {}
    );
  }
  return obj;
}

async function testCalc() {
  // Fetch user
  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
  
  // Fetch settings
  const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 'singleton').maybeSingle();
  const attendance = toCamelCase(settingsData).attendanceSettings;

  // Fetch events for May 2026
  const { data: events } = await supabase
    .from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', '2026-05-01T00:00:00Z')
    .lte('timestamp', '2026-05-31T23:59:59Z');

  // Fetch leaves
  const { data: leaves } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved');

  // Fetch holidays
  const { data: holidays } = await supabase
    .from('holidays')
    .select('*');

  // Calculate
  const result = processEmployeeMonth(
    user,
    events || [],
    leaves || [],
    [], // userHolidays
    2026,
    5,
    holidays || [],
    [],
    [],
    [],
    leaves || [],
    user.role,
    [],
    null,
    attendance,
    []
  );

  console.log("Calculated May 29 Status:", result.dailyData.find(d => d.date === 29));
  console.log("Calculated Summary:", {
    sickLeaves: result.sickLeaves,
    lossOfPay: result.lossOfPay
  });
}

testCalc().catch(console.error);
