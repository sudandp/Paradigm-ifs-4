const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function exportEmails() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    console.error(error);
    return;
  }
  const emails = data.users.map(u => u.email).filter(Boolean);
  fs.writeFileSync('Store_Assets/testers.csv', emails.join('\n'));
  fs.writeFileSync('Store_Assets/testers_list.txt', emails.join(', '));
  console.log('Exported ' + emails.length + ' emails');
}
exportEmails();
