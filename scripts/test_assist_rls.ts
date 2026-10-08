import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function testRLS() {
  console.log('--- 🧪 Testing Paradigm Assist RLS Policies ---');

  // 1. Anon client test (Unauthenticated)
  const anonClient = createClient(supabaseUrl, anonKey);
  
  const { data: anonKb, error: anonKbError } = await anonClient
    .from('knowledge_items')
    .select('id, title')
    .limit(3);

  console.log('1. Anon Read Published Knowledge Items:', {
    count: anonKb?.length ?? 0,
    error: anonKbError?.message ?? null,
    status: anonKbError ? 'PROTECTED (Rejected as expected)' : 'ALLOWED (Public read permitted)'
  });

  const { error: anonInsertError } = await anonClient
    .from('knowledge_items')
    .insert({
      title: 'Hacked Title',
      content: 'Hacked Content'
    });

  console.log('2. Anon Unauthorized Write to Knowledge Items:', {
    blocked: !!anonInsertError,
    error: anonInsertError?.message ?? 'VULNERABILITY: Anon was able to insert!'
  });

  const { data: updatedRows, error: anonSettingsWrite } = await anonClient
    .from('assist_settings')
    .update({ welcome_message: 'Hacked' })
    .eq('id', 'singleton')
    .select();

  const writeBlocked = !!anonSettingsWrite || (!updatedRows || updatedRows.length === 0);
  console.log('3. Anon Unauthorized Write to Assist Settings:', {
    blocked: writeBlocked,
    status: writeBlocked ? 'PROTECTED (0 rows modified / RLS filtered)' : 'VULNERABILITY: Modified row!'
  });

  // 2. Service Role Client Test (Admin Bypass for server operations)
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: serviceItems, error: serviceError } = await serviceClient
    .from('knowledge_items')
    .select('id, title, status')
    .limit(5);

  console.log('4. Service Role Admin Client Access:', {
    accessible: !serviceError && (serviceItems?.length ?? 0) > 0,
    itemCount: serviceItems?.length ?? 0
  });

  // 3. Test Hybrid Retrieval RPC Function
  const { data: rpcResults, error: rpcError } = await serviceClient
    .rpc('search_knowledge_base', {
      query_text: 'DG diesel refill',
      match_count: 3
    });

  console.log('5. Hybrid Retrieval search_knowledge_base RPC Test:', {
    success: !rpcError && (rpcResults?.length ?? 0) > 0,
    topMatch: rpcResults?.[0]?.title ?? null,
    confidence: rpcResults?.[0]?.composite_confidence ?? null,
    error: rpcError?.message ?? null
  });

  console.log('--- ✅ RLS & RPC Pre-flight Test Complete ---');
}

testRLS().catch(console.error);
