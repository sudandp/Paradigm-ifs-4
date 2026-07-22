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
  const userId = '2a82f0cc-effb-4576-917c-72408ea06b45' // Sanjay Ganapati Naik
  
  // Fetch events
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

  // Fetch leaves
  const { data: leaves } = await supabase.from('leave_requests')
    .select('*')
    .eq('user_id', userId)

  console.log('=== All Events grouped by day ===')
  Object.keys(eventsByDay).sort().forEach(dStr => {
    const d = new Date(dStr.replace(/-/g, '/'))
    const dayOfWeek = d.getDay()
    const dayName = format(d, 'EEEE')
    console.log(`${dStr} (${dayName}): ${eventsByDay[dStr].length} events`)
  })

  console.log('\n=== All Leave Requests ===')
  ;(leaves || []).forEach(l => {
    console.log(`[${l.leave_type}] ${l.start_date} to ${l.end_date} | status: ${l.status} | option: ${l.day_option} | reason: ${l.reason}`)
  })
}

main()
