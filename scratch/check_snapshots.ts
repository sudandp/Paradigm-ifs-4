import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  'https://fmyafuhxlorbafbacywa.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
);

async function check() {
  const { data, error } = await admin
    .from('monthly_attendance_snapshots')
    .select('*')
    .eq('year', 2026)
    .eq('month', 8);
  
  console.log('Snapshots count:', data?.length, 'error:', error);
  if (data && data.length > 0) {
    console.log('First snapshot:', JSON.stringify(data[0], null, 2));
  }
}

check().catch(console.error);
