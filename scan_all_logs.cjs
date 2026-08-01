const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function scanLogs() {
  const { data, error } = await supabase
    .from('email_logs')
    .select('recipient_email, subject, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return console.error(error.message);
  console.log('--- ALL EMAIL LOGS ---');
  (data || []).forEach(log => {
    console.log(`To: ${log.recipient_email} | Subject: ${log.subject} | Date: ${log.created_at}`);
  });
}

scanLogs();
