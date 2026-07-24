import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkPolicies() {
  console.log('=== CHECKING RLS POLICIES ===');
  
  const { data: policies, error: polErr } = await supabase.rpc('get_policies', {}, { head: false });
  // If get_policies RPC doesn't exist, we can use a direct SQL query via a function, or select from pg_policies.
  // Since we might not have a direct query RPC, let's query using a simple postgres query if possible, 
  // or query pg_catalog using an existing function if one exists, or query a known table.
  // Let's run a raw query using supabase sql runner if available.
  // Wait, let's see if we can query from a custom view or we can just query pg_policies using custom functions.
  // If not, let's look at the errors and test inserting as anon.
  
  // Let's try to insert into notifications as anon (without auth headers).
  const anonSupabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
  
  console.log('Inserting into notifications as anon...');
  const { error: notifErr } = await anonSupabase
    .from('notifications')
    .insert({
      user_id: 'eb8cbea0-edd6-47d2-9b61-b37d7b205589', // arbitrary uuid
      message: 'Test anon insert',
      type: 'security'
    });
    
  if (notifErr) {
    console.error('❌ Anon notifications insert failed:', notifErr.message, notifErr);
  } else {
    console.log('✅ Anon notifications insert succeeded!');
  }

  console.log('Inserting into security_audit_logs as authenticated/anon...');
  const { error: auditErr } = await anonSupabase
    .from('security_audit_logs')
    .insert({
      event_type: 'test_event',
      origin: 'test_origin',
      severity: 'Low',
      user_id: 'eb8cbea0-edd6-47d2-9b61-b37d7b205589'
    });

  if (auditErr) {
    console.error('❌ security_audit_logs insert failed:', auditErr.message, auditErr);
  } else {
    console.log('✅ security_audit_logs insert succeeded!');
  }
}

checkPolicies().catch(console.error);
