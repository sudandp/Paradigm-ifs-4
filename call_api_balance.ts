import { api } from './services/api'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Mock Network status for api.ts
import { Network } from '@capacitor/network';
(Network as any).getStatus = () => Promise.resolve({ connected: true });

async function run() {
  const userId = '94a4f34e-f4d0-42d5-b2c5-7b43419a3325' // Shilpa M
  try {
    const balance = await api.getLeaveBalancesForUser(userId)
    console.log('--- Balance for Shilpa M ---')
    console.log(JSON.stringify(balance, null, 2))
  } catch (err) {
    console.error(err)
  }
}

run()
