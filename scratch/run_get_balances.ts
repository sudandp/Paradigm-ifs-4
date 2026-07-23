import { api } from '../services/api';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
  const userId = '5321c6f6-578e-4168-9da8-060148e1587b'; // Sudhan M
  const balance = await api.getLeaveBalancesForUser(userId, '2026-07-23');
  console.log("=== API LEAVE BALANCE RESULT FOR SUDHAN M ===");
  console.log(JSON.stringify({
    compOffTotal: balance.compOffTotal,
    compOffUsed: balance.compOffUsed,
    compOffPending: balance.compOffPending,
    available: balance.compOffTotal - balance.compOffUsed - (balance.compOffPending || 0)
  }, null, 2));
}

test().catch(console.error);
