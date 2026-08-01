import { reportGenerators } from './utils/reportGenerators';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split(/\r?\n/).forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
});

const supabase = createClient(url, key);

async function testUpdatedGenerators() {
  const nakulId = '84d4ee16-b60f-401c-9478-584b7cbea26d';
  console.log('Testing crm_bd_daily generator output via reportGenerators...');
  const nowIST = new Date(new Date('2026-07-31T12:00:00Z').getTime()); // simulate 31 Jul
  const data = await reportGenerators.crm_bd_daily(supabase, nowIST, {
    dateRange: { start: '2026-07-31', end: '2026-07-31' }
  });
  console.log('=== TEST RESULT ===');
  console.log('KMs Travelled:', data.kmsTravelled || (data as any).kms_travelled);
  console.log('New Leads Count:', data.newLeadsCount || (data as any).new_leads_count);
  console.log('Prospect Calls:', data.prospectCalls || (data as any).prospect_calls);
  console.log('Followup Calls:', data.followupCalls || (data as any).followup_calls);
  console.log('Site Visits:', data.sitesCount || (data as any).sites_count);
}

testUpdatedGenerators().catch(console.error);

