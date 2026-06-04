import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const userId = '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27'; // Arpitha Nairy

async function inspectArpitha() {
  const { data: leaves, error } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'approved');

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Approved leaves for Arpitha Nairy:`, JSON.stringify(leaves, null, 2));
}

inspectArpitha();
