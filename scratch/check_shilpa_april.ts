import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import dotenv from 'dotenv'
import { format } from 'date-fns'

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
  
  const { data: events } = await supabase.from('attendance_events')
    .select('timestamp, type')
    .eq('user_id', userId)
    .gte('timestamp', '2026-04-10')
    .lte('timestamp', '2026-04-30')

  const attendedDates = new Set((events || [])
    .filter(e => e.type.toLowerCase().includes('check') || e.type.toLowerCase().includes('in'))
    .map(e => format(new Date(e.timestamp), 'yyyy-MM-dd')))

  console.log('Attended Dates in April 10-30:', Array.from(attendedDates))
  
  const is19thWorked = attendedDates.has('2026-04-19')
  console.log('Worked on April 19 (Sunday):', is19thWorked)

  const { data: settings } = await supabase.from('settings').select('*').eq('id', 'singleton').single()
  const fieldRules = settings.attendance_settings.field;
  console.log('Field Weekly Off Days:', fieldRules.weeklyOffDays)
}

run()
