import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { api } from '../services/api'

dotenv.config({ path: '.env.local' })

async function main() {
  const userId = '94a4f34e-f4d0-42d5-b2c5-7b43419a3325' // Shilpa M
  const balances = await api.getLeaveBalancesForUser(userId)
  console.log('=== Balances for Shilpa M ===')
  console.log('compOffTotal:', balances.compOffTotal)
  console.log('compOffUsed:', balances.compOffUsed)
  console.log('compOffPending:', balances.compOffPending)
  console.log('Available Comp Off:', balances.compOffTotal - balances.compOffUsed - balances.compOffPending)
}

main()
