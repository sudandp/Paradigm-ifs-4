import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const s = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  const userId = '5321c6f6-578e-4168-9da8-060148e1587b';
  const { data: u } = await s.from('users').select('id, name, email, phone, role_id, earned_leave_opening_balance, comp_off_opening_balance').eq('id', userId).single();
  console.log('USER:', u);

  const { data: lr } = await s.from('leave_requests')
    .select('id, leave_type, start_date, end_date, day_option, status')
    .eq('user_id', userId);
  console.log('LEAVE REQUESTS COUNT:', lr?.length);
  console.log('LEAVE REQUESTS:', JSON.stringify(lr, null, 2));

  const { data: allSnaps } = await s.from('attendance_month_snapshots').select('employee_id, year, month, summary').limit(5);
  console.log('ALL SNAPS:', allSnaps);

  // Check attendance events and route points for Sept 2026
  const { data: events } = await s.from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', '2026-09-01T00:00:00')
    .lte('timestamp', '2026-09-30T23:59:59');
  const CryptoJS = (await import('crypto-js')).default;
  const salt = "d61192c2a5add9b6f4acb020b26ec69d2c5b13d41f563d14a69a5294e5a800e3";
  const APP_ID = "com.paradigm.ifs";
  const key = CryptoJS.PBKDF2(APP_ID, salt, { keySize: 256 / 32, iterations: 1000 }).toString(CryptoJS.enc.Hex);
  
  const emailDec = CryptoJS.AES.decrypt("U2FsdGVkX1/6VABmIF+2st7baAWAsov71v6rKiJ+ZRElOXVDklOSJWlyhPR5EZuK", key).toString(CryptoJS.enc.Utf8);
  const tokenDec = CryptoJS.AES.decrypt("U2FsdGVkX189ev+RO1go2rq9DzUyXEkD3eSKj9rE8EI=", key).toString(CryptoJS.enc.Utf8);
  console.log('DECRYPTED EMAIL:', emailDec);
  console.log('DECRYPTED TOKEN:', tokenDec);

  // Now test with anon key
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjg1NDYsImV4cCI6MjA3NzgwNDU0Nn0.RqsniEqzNec6ww35TXJtLJD3mafnGbMI82om4XRUdUU";
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authPass, error: authPassErr } = await anon.auth.signInWithPassword({
    email: 'admin@paradigmfms.com',
    password: `PAR_${uPass.passcode}`
  });
  console.log('LOGIN WITH PAR_PASSCODE RESULT:', authPass?.user?.id, 'Session:', !!authPass?.session, 'Error:', authPassErr?.message);


}

run().catch(console.error);
