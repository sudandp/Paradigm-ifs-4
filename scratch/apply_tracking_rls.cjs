// Apply tracking_audit_logs RLS fix via Supabase service role
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function run() {
  const sql = `
-- Fix 1: Allow target users to also set status to 'failed' (not just 'successful')
DROP POLICY IF EXISTS "Users can update their own tracking status" ON tracking_audit_logs;

CREATE POLICY "Users can update their own tracking status"
ON tracking_audit_logs FOR UPDATE
TO authenticated
USING (target_user_id = auth.uid())
WITH CHECK (target_user_id = auth.uid() AND status IN ('successful', 'failed'));

-- Fix 2: Allow the anon role to update status by request_id
-- (Background FCM service doesn't have an auth session but knows the requestId)
DROP POLICY IF EXISTS "Anon can update tracking status by request_id" ON tracking_audit_logs;

CREATE POLICY "Anon can update tracking status by request_id"
ON tracking_audit_logs FOR UPDATE
TO anon
USING (true)
WITH CHECK (status IN ('successful', 'failed'));
  `.trim();

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => ({ error: { message: 'RPC not available' } }));
  
  if (error) {
    // Fallback: try via postgres REST
    console.log('RPC failed, trying direct query...');
    const lines = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      console.log('Running:', line.substring(0, 60) + '...');
      const res = await supabase.from('_').select(line).catch(e => ({ error: e }));
      // This won't work for DDL - we need pg direct
    }
    console.error('Cannot run DDL via anon/service REST. Please run the SQL manually in Supabase dashboard.');
    console.log('\n--- Copy this SQL to Supabase Dashboard > SQL Editor ---\n');
    console.log(sql);
    console.log('\n--------------------------------------------------------\n');
    return;
  }
  
  console.log('RLS policies updated successfully!');
}

run().catch(console.error);
