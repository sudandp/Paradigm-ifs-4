const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function inspectRender() {
  const { data: rule } = await supabase.from('email_schedule_rules').select('*, template:email_templates(*)').eq('id', '1c3dd098-1423-4a91-a5fa-6451dff6494d').single();
  console.log('Rule:', rule.name, 'Report type:', rule.report_type);
  const template = rule.template;
  console.log('Template Subject:', template.subject_template);
  
  // Let's check email_logs for recent sends to sudhan@paradigmfms.com
  const { data: logs } = await supabase.from('email_logs')
    .select('*')
    .eq('recipient_email', 'sudhan@paradigmfms.com')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('Recent logs:');
  logs?.forEach(l => {
    console.log(`- [${l.created_at}] Subject: "${l.subject}" Status: ${l.status}`);
  });
}

inspectRender().catch(console.error);
