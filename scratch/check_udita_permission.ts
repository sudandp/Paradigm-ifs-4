import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

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
  console.log('User:', user?.id, user?.name)

  if (!user) return

  const { data: leaves } = await supabase.from('leave_requests')
    .select('*')
    .eq('user_id', user.id)

  console.log('=== All Leaves for Udita Paul ===')
  ;(leaves || []).forEach(l => {
    console.log(`- ID: ${l.id} | Type: ${l.leave_type} | Start: ${l.start_date} | End: ${l.end_date} | Status: ${l.status} | Option: ${l.day_option} | Reason: ${l.reason}`)
  })
}

main()
