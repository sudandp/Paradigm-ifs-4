import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fmyafuhxlorbafbacywa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: sample, error: sErr } = await supabase
    .from('users')
    .select('*')
    .limit(1);
  if (sample && sample[0]) {
    console.log('Users columns:', Object.keys(sample[0]));
  }
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email');
    
  if (error) {
    console.error(error);
    return;
  }
  
  const searchNames = [
    'Sandeep', 'Shilpa', 'Issac', 'Isaac', 'Venkat', 'Harish', 
    'Murali', 'Muruli', 'Sashikanth', 'Stany', 'Omkar', 'Kannaiah', 
    'Chandana', 'Pooja', 'Kavya', 'Arpitha', 'Sinchana', 'Arya', 'Sudhan'
  ];
  
  const matches = (users || []).filter(u => 
    searchNames.some(s => (u.name || '').toLowerCase().includes(s.toLowerCase()))
  );
  
  console.log(`Matched Users (${matches.length}):`);
  for (const m of matches) {
    console.log(`- Name: "${m.name}" | ID: ${m.id} | Email: ${m.email}`);
  }
  
  console.log(`\nTotal registered users in DB: ${users?.length}`);
}

check();
