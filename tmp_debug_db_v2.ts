
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  console.log('--- START DEBUG V2 ---')
  
  // 1. Get last 10 notifications with user names
  const { data, error } = await supabase
    .from('notifications')
    .select('created_at, message, type, user_id, is_read, metadata')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error:', error)
  } else {
    data.forEach((n, i) => {
      console.log(`${i+1}. [${n.created_at}] Type: ${n.type}, User: ${n.user_id}, Msg: ${n.message.substring(0, 50)}...`)
      console.log(`   Metadata: ${JSON.stringify(n.metadata)}`)
    })
  }

  // 2. Check if any notification exists for 'emergency_broadcast' in the last 10 mins
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'emergency_broadcast')
    .gte('created_at', tenMinsAgo)
  
  console.log(`Recent emergency broadcasts (last 10m): ${count}`)

  console.log('--- END DEBUG V2 ---')
}

debug()
