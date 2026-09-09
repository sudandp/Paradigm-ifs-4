const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => (env.match(new RegExp(key + '\\s*=\\s*"?([^"\\r\\n]+)"?')) || [])[1];
const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'));

async function main() {
  const { data: logs } = await supabase.from('email_logs').select('*').order('created_at', { ascending: false }).limit(10);
  console.log('--- LATEST 10 EMAIL LOGS ---');
  for (const l of logs || []) {
    console.log(`[${l.created_at}] Rule: ${l.rule_id} | Status: ${l.status} | Recipient: ${l.recipient_email} | Subject: ${l.subject} | Error: ${l.error_message}`);
  }

  const { data: rules } = await supabase.from('email_schedule_rules').select('*');
  console.log('\n--- EMAIL SCHEDULE RULES ---');
  for (const r of rules || []) {
    console.log(`[${r.id}] "${r.name}" | Active: ${r.is_active} | Config: ${JSON.stringify(r.schedule_config)} | Last Sent: ${r.last_sent_at}`);
  }
}

main();
