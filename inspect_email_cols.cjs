const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function inspectColumns() {
  const { data, error } = await supabase.from('email_logs').select('*').limit(1);
  if (error) return console.error(error.message);
  console.log('Columns in email_logs:', Object.keys(data[0] || {}));
}

inspectColumns();
