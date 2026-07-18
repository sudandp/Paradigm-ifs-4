const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectSentEmailRow() {
  const { data: logs, error } = await supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
  } else if (logs && logs.length > 0) {
    const log = logs[0];
    console.log('Log entry columns:');
    Object.keys(log).forEach(key => {
      console.log(`- ${key}: ${typeof log[key]} (length/value: ${log[key] ? (log[key].length || log[key]) : 'null/empty'})`);
    });
    console.log('Metadata:', JSON.stringify(log.metadata, null, 2));
  } else {
    console.log('No email logs found.');
  }
}

inspectSentEmailRow();
