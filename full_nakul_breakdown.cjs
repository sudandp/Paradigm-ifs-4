const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function fullBreakdown() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  const { data: leads } = await supabase.from('crm_leads').select('*');
  
  const nakulLeads = (leads || []).filter(l => l.created_by === nakulId || l.assigned_to === nakulId);
  console.log('Total Nakul Leads:', nakulLeads.length);

  const stages = {
    'New Lead': 0,
    'Contacted': 0,
    'Site Visit Planned': 0,
    'Survey Completed': 0,
    'Proposal Sent': 0,
    'Negotiation': 0,
    'Won': 0,
    'Lost': 0
  };

  nakulLeads.forEach(l => {
    if (stages[l.status] !== undefined) stages[l.status]++;
    else stages[l.status] = (stages[l.status] || 0) + 1;
  });

  console.log('--- PIPELINE STAGE COUNTS FOR NAKUL ---');
  console.log(JSON.stringify(stages, null, 2));

  let activePipelineTotal = 0;
  Object.keys(stages).forEach(st => {
    if (!['Won', 'Lost'].includes(st)) activePipelineTotal += stages[st];
  });
  console.log('TOTAL ACTIVE PIPELINE LEADS:', activePipelineTotal);

  // List lead names by stage
  console.log('\n--- LEADS DETAIL BY STAGE ---');
  nakulLeads.forEach(l => {
    console.log(`- ${l.client_name || l.association_name || l.company_name} | Stage: [${l.status}]`);
  });
}

fullBreakdown();
