import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const userId = '4e1fcd1e-c4c7-4175-be8b-dec31a6b5206' // Udita Paul
  const dateStr = '2026-06-27'

  // Fetch Attendance Events for June 27, 2026
  const { data: events } = await supabase.from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', `${dateStr}T00:00:00`)
    .lte('timestamp', `${dateStr}T23:59:59`)

  console.log('=== ATTENDANCE EVENTS ON JUNE 27, 2026 ===')
  console.log(JSON.stringify(events, null, 2))

  // Fetch Leave & Correction Requests on June 27, 2026
  const { data: leaves } = await supabase.from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .lte('start_date', dateStr)
    .gte('end_date', dateStr)

  console.log('\n=== LEAVE & CORRECTION & PERMISSION REQUESTS ON JUNE 27, 2026 ===')
  console.log(JSON.stringify(leaves, null, 2))
}

main()
