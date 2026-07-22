import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { format, startOfMonth, subMonths } from 'date-fns'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const email = 'fireofficer@paradigmfms.com'
  const { data: user, error: uErr } = await supabase.from('users').select('*').eq('email', email).single()

  if (!user) {
    console.error('User not found:', email, uErr)
    return
  }

  console.log('=== USER DETAILS ===')
  console.log('ID:', user.id)
  console.log('Name:', user.name)
  console.log('Role:', user.role)
  console.log('Category/StaffType:', user.staff_type || user.category || 'office')
  console.log('Gender:', user.gender)
  console.log('Comp Off Opening Balance:', user.comp_off_opening_balance, user.comp_off_opening_date)

  // 1. Attendance Events in 2026
  const { data: events } = await supabase.from('attendance_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('timestamp', '2026-01-01')

  const eventsByDay: Record<string, any[]> = {}
  ;(events || []).forEach(e => {
    const dStr = format(new Date(e.timestamp), 'yyyy-MM-dd')
    if (!eventsByDay[dStr]) eventsByDay[dStr] = []
    eventsByDay[dStr].push(e)
  })

  console.log('\n=== SUNDAYS WORKED IN 2026 ===')
  let sundayWorkedCount = 0
  Object.keys(eventsByDay).sort().forEach(dStr => {
    const d = new Date(dStr.replace(/-/g, '/'))
    if (d.getDay() === 0) {
      sundayWorkedCount++
      console.log(`- Sunday: ${dStr} (${eventsByDay[dStr].length} events)`)
    }
  })

  // 2. Comp Off Logs
  const { data: compOffLogs } = await supabase.from('comp_off_logs')
    .select('*')
    .eq('user_id', user.id)

  console.log('\n=== COMP OFF LOGS (comp_off_logs) ===')
  console.log('Count:', compOffLogs?.length || 0)
  ;(compOffLogs || []).forEach(log => {
    console.log(`- Date: ${log.date_earned || log.dateEarned} | Status: ${log.status} | Reason: ${log.reason}`)
  })

  // 3. Leave Requests (Comp Off)
  const { data: leaves } = await supabase.from('leave_requests')
    .select('*')
    .eq('user_id', user.id)

  console.log('\n=== COMP OFF LEAVE REQUESTS ===')
  const compOffLeaves = (leaves || []).filter(l => String(l.leave_type).toLowerCase().includes('comp'))
  compOffLeaves.forEach(l => {
    console.log(`- Date: ${l.start_date} to ${l.end_date} | Status: ${l.status} | Option: ${l.day_option} | Reason: ${l.reason}`)
  })
}

main()
