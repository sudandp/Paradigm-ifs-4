
const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://fmyafuhxlorbafbacywa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M');

async function run() {
  const { data: template } = await s.from('email_templates').select('*').eq('id', '0893f101-b400-4986-a3b7-c3128df1bddf').single();
  console.log('TEMPLATE BODY:', template.body_template);
}
run();
