const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function checkEmailLogs() {
  const { data, error } = await supabase.from('email_logs').select('*').order('created_at', { ascending: false }).limit(20);
  if (error) {
    console.error('Error fetching email_logs:', error.message);
  } else {
    console.log('--- EMAIL LOGS ---');
    (data || []).forEach(log => {
      console.log(`To: ${log.to} | Subject: ${log.subject} | Created At: ${log.created_at}`);
    });
  }
}

checkEmailLogs();
