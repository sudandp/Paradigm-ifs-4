import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testAccess() {
  console.log('--- Testing table access via service role ---');

  // Test notifications
  const { data: notifs, error: nErr } = await supabase.from('notifications').select('id, user_id, message').limit(1);
  console.log('notifications read test:', nErr ? `FAIL: ${nErr.message}` : `OK (${notifs?.length} rows)`);

  // Test fcm_tokens
  const { data: tokens, error: tErr } = await supabase.from('fcm_tokens').select('id, user_id, token').limit(1);
  console.log('fcm_tokens read test:', tErr ? `FAIL: ${tErr.message}` : `OK (${tokens?.length} rows)`);

  // Test rule_inheritance_cache
  const { data: cache, error: cErr } = await supabase.from('rule_inheritance_cache').select('id, user_id, resolved_scope').limit(1);
  console.log('rule_inheritance_cache read test:', cErr ? `FAIL: ${cErr.message}` : `OK (${cache?.length} rows)`);
}

testAccess().catch(console.error);
