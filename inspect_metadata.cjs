const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function inspectMetadata() {
  const { data, error } = await supabase
    .from('email_logs')
    .select('id, subject, metadata, created_at')
    .ilike('subject', '%Nakul%')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return console.error(error.message);
  
  (data || []).forEach(log => {
    console.log(`Subject: ${log.subject} | Metadata:`, JSON.stringify(log.metadata));
  });
}

inspectMetadata();
