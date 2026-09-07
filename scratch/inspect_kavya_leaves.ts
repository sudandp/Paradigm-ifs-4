import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  'https://fmyafuhxlorbafbacywa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
);

async function inspectLeaves() {
  const { data: users } = await admin.from('users').select('*').eq('name', 'Kavya M');
  const kavya = users?.[0];
  console.log('Kavya:', kavya?.id);

  const { data: leaves } = await admin.from('leave_requests').select('*').eq('user_id', kavya.id);
  console.log('Total leaves for Kavya:', leaves?.length);
  leaves?.forEach(l => {
    console.log({
      id: l.id,
      leave_type: l.leave_type,
      start_date: l.start_date,
      end_date: l.end_date,
      status: l.status,
      reason: l.reason,
      correction_details: l.correction_details
    });
  });
}

inspectLeaves().catch(console.error);
