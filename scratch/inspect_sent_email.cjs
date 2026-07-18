const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectSentEmail() {
  const { data: logs, error } = await supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
  } else if (logs && logs.length > 0) {
    const log = logs[0];
    console.log(`Last email sent at: ${log.created_at}`);
    console.log(`Subject: ${log.subject}`);
    console.log(`Recipient: ${log.recipient_email}`);
    fs.writeFileSync('scratch/last_email_sent.html', log.html || '');
    console.log('Saved HTML to scratch/last_email_sent.html');
  } else {
    console.log('No email logs found.');
  }
}

inspectSentEmail();
