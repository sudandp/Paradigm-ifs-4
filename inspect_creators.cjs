const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function inspectCreators() {
  const { data: leads } = await supabase.from('crm_leads').select('id, company_name, created_by, assigned_to, status');
  console.log('--- ALL LEADS IN SYSTEM ---');
  console.log(leads);
}

inspectCreators();
