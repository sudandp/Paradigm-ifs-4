import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  const userId = '94a4f34e-f4d0-42d5-b2c5-7b43419a3325' // Shilpa M
  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single()
  console.log('User Opening Balance:', user?.comp_off_opening_balance, user?.comp_off_opening_date)

  const { data: compOffLogs } = await supabase.from('comp_off_logs').select('*').eq('user_id', userId)
  console.log('Comp Off Logs count:', compOffLogs?.length)
  console.log('Comp Off Logs:', compOffLogs)

  const { data: leaves } = await supabase.from('leave_requests').select('*').eq('user_id', userId).eq('leave_type', 'Comp Off')
  console.log('Comp Off Leaves:', leaves?.map(l => ({ id: l.id, start: l.start_date, status: l.status, day_option: l.day_option })))
}

main()
