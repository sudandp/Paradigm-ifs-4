
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M'
const supabase = createClient(supabaseUrl, supabaseKey)

async function testSingleNotification() {
  console.log('--- TESTING SINGLE NOTIFICATION ---')
  
  // 1. Find user Sudhan M
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', '%Sudhan M%')
    .limit(1)

  if (userError || !userData?.length) {
    console.error('User not found:', userError)
    return
  }

  const userId = userData[0].id
  console.log(`Found user: ${userData[0].name} (${userId})`)

  // 2. Insert notification
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      message: 'SINGLE TARGET TEST ' + new Date().toISOString(),
      type: 'emergency_broadcast',
      severity: 'High',
      metadata: { test: true, title: 'Sudhan Specific Alert' }
    })
    .select()

  if (error) {
    console.error('Insert Error:', error)
  } else {
    console.log('Insert Success!', data)
  }

  console.log('--- END TEST ---')
}

testSingleNotification()
