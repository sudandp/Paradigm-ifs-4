import { createClient } from '@supabase/supabase-client'
import * as dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  const { data, error } = await supabase
    .from('gate_users')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error(error)
  } else {
    console.log(Object.keys(data[0] || {}))
  }
}

checkSchema()
