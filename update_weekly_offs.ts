import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fmyafuhxlorbafbacywa.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M');
async function run() {
  const { data: users, error } = await supabase.from('users').select('id, name, role_id, roles(display_name), weekly_off_days');
  if (error) { console.error("FETCH ERROR:", error); return; }
  if (!users) { console.log("NO USERS FOUND"); return; }
  const targetUsers = users.filter((u: any) => 
    (u.roles?.display_name?.toLowerCase().includes('field') || u.roles?.display_name?.toLowerCase().includes('office')) &&
    (!u.weekly_off_days || u.weekly_off_days.length === 0)
  );
  if (targetUsers.length > 0) {
    const userIds = targetUsers.map((u: any) => u.id);
    const { data, error: upError } = await supabase.from('users').update({ weekly_off_days: [0] }).in('id', userIds).select();
    if (upError) console.error("UPDATE ERROR:", upError);
    else console.log('Successfully updated ' + (data?.length || 0) + ' users.');
  } else {
    console.log('No users to update.');
  }
}
run();
