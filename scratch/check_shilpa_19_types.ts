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
    .select('timestamp, type, work_type')
    .eq('user_id', userId)
    .gte('timestamp', '2026-04-19T00:00:00')
    .lte('timestamp', '2026-04-19T23:59:59')

  console.log('Events on April 19:', JSON.stringify(events, null, 2))
}

run()
