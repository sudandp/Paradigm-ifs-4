import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { format } from 'date-fns'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const userId = '94a4f34e-f4d0-42d5-b2c5-7b43419a3325' // Shilpa M
  const { data: events } = await supabase.from('attendance_events')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', '2026-01-01')

  const eventsByDay: Record<string, any[]> = {}
  ;(events || []).forEach(e => {
    const dStr = format(new Date(e.timestamp), 'yyyy-MM-dd')
    if (!eventsByDay[dStr]) eventsByDay[dStr] = []
    eventsByDay[dStr].push(e)
  })

  console.log('--- All Worked Dates in 2026 ---')
  Object.keys(eventsByDay).sort().forEach(dStr => {
    const d = new Date(dStr.replace(/-/g, '/'))
    const dayOfWeek = d.getDay()
    if (dayOfWeek === 0) { // Sunday
      console.log('Sunday Worked:', dStr, eventsByDay[dStr].map(e => `${e.type} @ ${e.timestamp.split('T')[1]}`))
    }
  })

  const { data: leaves } = await supabase.from('leave_requests')
    .select('*')
    .eq('user_id', userId)

  console.log('\n--- All Approved / Correction Leaves ---')
  ;(leaves || []).forEach(l => {
    const status = l.status
    if (status === 'approved' || status === 'correction_made') {
      console.log(`[${l.leave_type}] ${l.start_date} to ${l.end_date} | status: ${status} | option: ${l.day_option} | reason: ${l.reason}`)
    }
  })
}

main()
