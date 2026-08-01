const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function testFetch() {
  const { data, error } = await supabase.from('crm_leads').select('*');
  console.log('Error:', error);
  console.log('Data length:', data ? data.length : null);
  if (data && data.length > 0) {
    console.log('First lead:', data[0]);
  }
}

testFetch();
