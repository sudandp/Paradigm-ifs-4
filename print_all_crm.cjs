const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function inspectLeads() {
  const { data: leads } = await supabase.from('crm_leads').select('id, company_name, created_by, assigned_to, status, created_at');
  console.log('Total Leads:', leads ? leads.length : 0);
  console.log(leads);

  const { data: followups } = await supabase.from('crm_followups').select('*');
  console.log('Total Followups:', followups ? followups.length : 0);
  console.log(followups);
}

inspectLeads();
