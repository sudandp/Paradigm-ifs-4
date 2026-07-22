import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { processEmployeeMonth } from '../utils/monthlyReportCalculations'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const { data: user } = await supabase.from('users').select('*').ilike('name', '%Udita%').single()
  if (!user) return

  const { data: events } = await supabase.from('attendance_events')
    .select('*')
    .eq('user_id', user.id)
    .gte('timestamp', '2026-06-01')
    .lte('timestamp', '2026-06-30T23:59:59')

  const { data: leaves } = await supabase.from('leave_requests')
    .select('*')
    .eq('user_id', user.id)

  const result = processEmployeeMonth(
    user,
    events || [],
    leaves || [],
    [],
    2026,
    6,
    [],
    [],
    [],
    [],
    leaves || [],
    undefined,
    [],
    null,
    { office: {}, field: {}, site: {} },
    []
  )

  console.log('=== June 27 Data ===')
  const day27 = result.dailyData.find(d => d.date === 27)
  console.log(JSON.stringify(day27, null, 2))
}

main()
