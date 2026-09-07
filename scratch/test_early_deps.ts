import { createClient } from '@supabase/supabase-js';
import { getEarlyDepartureDeductions } from '../utils/attendanceCalculations';

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

async function test() {
  const { data: users } = await admin.from('users').select('*');
  const kavya = users?.find(u => u.name === 'Kavya M');
  const { data: leaves } = await admin.from('leave_requests').select('*').eq('user_id', kavya.id);
  const { data: events } = await admin.from('attendance_events').select('*').eq('user_id', kavya.id).gte('timestamp', '2026-08-01').lte('timestamp', '2026-08-31T23:59:59');

  const camelLeaves = (leaves || []).map(toCamelCase);
  const camelEvents = (events || []).map(toCamelCase);

  const deductions = getEarlyDepartureDeductions(camelEvents, 480, camelLeaves, camelLeaves, '2026-08');
  console.log('Early departure deductions for Kavya M in Aug 2026:', deductions);
}

test().catch(console.error);
