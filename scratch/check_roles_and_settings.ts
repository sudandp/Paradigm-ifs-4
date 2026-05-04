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
  console.log('--- Fetching Roles ---')
  const { data: roles, error: rError } = await supabase.from('roles').select('*')
  if (rError) console.error(rError)
  else console.log('Roles:', JSON.stringify(roles, null, 2))

  console.log('--- Fetching Settings ---')
  const { data: settings, error: sError } = await supabase.from('settings').select('*').eq('id', 'singleton').single()
  if (sError) console.error(sError)
  else console.log('Settings:', JSON.stringify(settings.attendance_settings, null, 2))

  console.log('--- Fetching Sample Field Staff ---')
  const { data: users, error: uError } = await supabase.from('users')
    .select('id, name, role_id, role:roles(display_name)')
    .ilike('name', '%Shilpa%')
  if (uError) console.error(uError)
  else console.log('Sample Users:', JSON.stringify(users, null, 2))
}

run()
