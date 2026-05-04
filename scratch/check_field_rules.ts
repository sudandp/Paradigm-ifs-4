import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 'singleton').single()
  const fieldRules = settings.attendance_settings.field;
  console.log('--- Field Attendance Rules ---')
  console.log(JSON.stringify(fieldRules, null, 2))
}

run()
