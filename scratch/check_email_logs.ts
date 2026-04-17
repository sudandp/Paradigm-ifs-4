import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmailLogs() {
  console.log('Checking recent email logs...');
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching email logs:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No email logs found.');
    return;
  }

  data.forEach(log => {
    console.log(`[${log.created_at}] To: ${log.recipient_email} | Subject: ${log.subject} | Status: ${log.status}`);
    if (log.metadata) {
        console.log(`  Metadata: ${JSON.stringify(log.metadata)}`);
    }
  });
}

checkEmailLogs();
