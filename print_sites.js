import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => {
  const match = env.match(new RegExp(`${key}\\s*=\\s*"?([^"\\n\\r]+)"?`))
  return match ? match[1].trim() : null
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const { data: entities } = await supabase.from('entities').select('*')
  console.log('Entities:')
  entities.forEach(e => {
    console.log(`- ID: ${e.id}, Name: ${e.name}, Company ID: ${e.company_id}`)
    if (e.departments) {
      console.log('  Departments:', e.departments.map(d => d.name))
    }
  })
}

run()
