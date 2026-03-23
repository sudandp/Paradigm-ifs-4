
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testRpc() {
  console.log('--- TESTING RPC ---')
  
  const { data, error } = await supabase.rpc('broadcast_notification', {
    p_message: 'TEST BROADCAST ' + new Date().toISOString(),
    p_type: 'emergency_broadcast',
    p_severity: 'High',
    p_metadata: { test: true },
    p_link_to: null
  })

  if (error) {
    console.error('RPC Error:', error)
  } else {
    console.log('RPC Success!', data)
    
    // Check if rows were inserted
    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'emergency_broadcast')
      .like('message', 'TEST BROADCAST%')
    
    console.log(`Rows inserted for TEST BROADCAST: ${count}`, countError || '')
  }

  console.log('--- END TEST ---')
}

testRpc()
