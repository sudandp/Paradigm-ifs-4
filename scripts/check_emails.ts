import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

async function checkSchedules() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  console.log('--- Email Schedule Rules ---');
  try {
    const { data: rules, error: rulesErr } = await supabase.from('email_schedule_rules').select('*');
    if (rulesErr) console.error(rulesErr);
    else console.table((rules || []).map((r: any) => ({ id: r.id, name: r.name, active: r.is_active, trigger: r.trigger_type, last_sent: r.last_sent_at })));
  } catch (e) {
    console.error('Check failed:', e);
  }

  console.log('\n--- Recent Email Logs ---');
  try {
    const { data: logs, error: logsErr } = await supabase.from('email_logs').select('*').order('created_at', { ascending: false }).limit(5);
    if (logsErr) console.error(logsErr);
    else console.table((logs || []).map((l: any) => ({ id: l.id, rule: l.rule_id, recipient: l.recipient_email, status: l.status })));
  } catch (e) {
    console.error('Logs check failed:', e);
  }
}

checkSchedules();
