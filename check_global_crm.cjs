const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function checkAll() {
  const { count: leadCount } = await supabase.from('crm_leads').select('*', { count: 'exact', head: true });
  const { count: followupCount } = await supabase.from('crm_followups').select('*', { count: 'exact', head: true });
  console.log('Total CRM Leads in system:', leadCount);
  console.log('Total CRM Followups in system:', followupCount);

  // Sample leads
  const { data: sampleLeads } = await supabase.from('crm_leads').select('id, company_name, created_by, assigned_to').limit(10);
  console.log('Sample Leads:', sampleLeads);
}

checkAll();
