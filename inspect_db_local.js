import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Manual env parsing
const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}\\s*=\\s*"?([^"\\n\\r]+)"?`))
  return match ? match[1].trim() : null
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('--- Fetching Templates ---')
  const { data: templates, error: tError } = await supabase.from('email_templates').select('*')
  if (tError) console.error(tError)
  else console.log('Templates:', JSON.stringify(templates, null, 2))

  console.log('--- Fetching Schedules ---')
  const { data: rules } = await supabase.from('email_schedule_rules').select('*')
  console.log('Rules:', JSON.stringify(rules, null, 2))
}

run()
