
const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://fmyafuhxlorbafbacywa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M');

async function run() {
  const { data: rules, error } = await s.from('email_schedule_rules').select('*');
  if (error) {
    console.error('ERROR:', error);
    return;
  }
  console.log('RULES FOUND:', rules.length);
  rules.forEach(r => {
    console.log('RULE:', r.name, 'TYPE:', r.report_type, 'TEMPLATE:', r.template_id, 'ACTIVE:', r.is_active);
  });
}
run();
