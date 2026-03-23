
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  console.log('--- START DEBUG ---')
  
  // 1. Check users count
  const { count: userCount, error: userError } = await supabase.from('users').select('*', { count: 'exact', head: true })
  console.log('Total users in public.users:', userCount, userError || '')

  // 2. Check last 5 notifications
  const { data: lastNotifs, error: notifError } = await supabase
    .from('notifications')
    .select('*, users(name)')
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (notifError) console.error('Error fetching notifications:', notifError)
  else {
    console.log('Last 5 notifications:')
    lastNotifs.forEach(n => {
      console.log(`- [${n.created_at}] User: ${n.users?.name || n.user_id}, Message: ${n.message}, Type: ${n.type}`)
    })
  }

  // 3. Check for specific emergency_broadcast types
  const { count: broadcastCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'emergency_broadcast')
  console.log('Total emergency_broadcast notifications:', broadcastCount)

  console.log('--- END DEBUG ---')
}

debug()
