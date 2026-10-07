const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function inspectHtml() {
  const { data: rule } = await supabase.from('email_schedule_rules').select('*, template:email_templates(*)').eq('id', '1c3dd098-1423-4a91-a5fa-6451dff6494d').single();
  const template = rule.template;
  console.log('Template ID:', template.id);
  console.log('Body template first 400 chars:');
  console.log(template.body_template.slice(0, 400));
}

inspectHtml().catch(console.error);
