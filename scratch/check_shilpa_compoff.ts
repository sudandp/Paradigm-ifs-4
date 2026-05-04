import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import dotenv from 'dotenv'
import { format, startOfYear, endOfMonth } from 'date-fns'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const userId = '94a4f34e-f4d0-42d5-b2c5-7b43419a3325' // Shilpa M
  const yearStart = '2026-01-01'
  const referenceDate = new Date()
  
  const { data: events } = await supabase.from('attendance_events')
    .select('timestamp, type')
    .eq('user_id', userId)
    .gte('timestamp', yearStart)
    .lte('timestamp', '2026-12-31')

  const attendedDates = new Set((events || [])
    .filter(e => e.type.toLowerCase().includes('check') || e.type.toLowerCase().includes('in'))
    .map(e => format(new Date(e.timestamp), 'yyyy-MM-dd')))

  console.log('Attended Dates Count:', attendedDates.size)
  
  let sundaysWorked = 0;
  attendedDates.forEach(dateStr => {
    const d = new Date(dateStr.replace(/-/g, '/'))
    if (d.getDay() === 0) {
      sundaysWorked++;
      console.log('Worked on Sunday:', dateStr)
    }
  })

  console.log('Total Sundays Worked:', sundaysWorked)

  const { data: holidays } = await supabase.from('holidays').select('*')
  const holidayDates = new Set((holidays || []).map(h => format(new Date(h.date), 'yyyy-MM-dd')))
  
  const { data: userHolidays } = await supabase.from('user_holidays').select('*').eq('user_id', userId)
  if (userHolidays) {
    userHolidays.forEach(uh => {
      if (uh.holiday_date) holidayDates.add(uh.holiday_date)
    })
  }

  let holidaysWorked = 0;
  attendedDates.forEach(dateStr => {
    if (holidayDates.has(dateStr)) {
      const d = new Date(dateStr.replace(/-/g, '/'))
      if (d.getDay() !== 0) { // Don't double count Sundays
        holidaysWorked++;
        console.log('Worked on Holiday:', dateStr)
      }
    }
  })

  console.log('Total Holidays Worked:', holidaysWorked)
  
  const { data: leaveRequests } = await supabase.from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .ilike('leave_type', '%comp%')

  console.log('Comp Off Leave Requests:', JSON.stringify(leaveRequests, null, 2))
}

run()
