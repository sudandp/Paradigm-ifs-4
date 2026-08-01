const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function inspectNakulAllLeads() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  const { data: leads } = await supabase.from('crm_leads').select('id, company_name, client_name, association_name, status, created_by, assigned_to, created_at').or(`created_by.eq.${nakulId},assigned_to.eq.${nakulId}`);
  console.log('--- NAKUL ALL LEADS (Total: ' + (leads ? leads.length : 0) + ') ---');
  console.log(leads);

  const stages = {};
  (leads || []).forEach(l => {
    stages[l.status] = (stages[l.status] || 0) + 1;
  });
  console.log('--- STAGE SUMMARY FOR NAKUL ---');
  console.log(stages);
}

inspectNakulAllLeads();
