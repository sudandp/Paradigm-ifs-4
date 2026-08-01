const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function checkTables() {
  const { data: tables, error } = await supabase.from('email_logs').select('*').limit(10);
  console.log('email_logs:', error ? error.message : data);
}

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // if exists
  console.log('rpc get_tables:', error ? error.message : data);
}

checkTables();
