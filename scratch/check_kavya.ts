import { createClient } from '@supabase/supabase-js';
const admin = createClient('https://fmyafuhxlorbafbacywa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M');

async function check() {
  const { data: users } = await admin.from('users').select('*');
  const matching = users?.filter(u => u.name?.toLowerCase().includes('kavya'));
  console.log('Matching users:', matching);
  for (const u of (matching || [])) {
    console.log('=== USER:', u.name, u.id, u.email, '===');
    const { data: leaves } = await admin.from('leave_requests').select('*').eq('user_id', u.id);
    console.log('Leaves:', leaves);
  }
}
check().catch(console.error);
