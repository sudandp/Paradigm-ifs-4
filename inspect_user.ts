import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function inspect() {
  const societyId = 'comp_1775122124670';
  const orgId = 'ent_1777888005956';
  const locationId = 'group_1774003567612';

  console.log("Fetching company:");
  const { data: company } = await supabase.from('companies').select('id, name, location, group_id').eq('id', societyId).single();
  console.log(company);

  console.log("Fetching entity:");
  const { data: entity } = await supabase.from('entities').select('id, name, location, company_id').eq('id', orgId).single();
  console.log(entity);

  console.log("Fetching group:");
  const { data: group } = await supabase.from('organization_groups').select('id, name').eq('id', locationId).single();
  console.log(group);
}

inspect();
