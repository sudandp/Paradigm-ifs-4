
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectLeaveRequestsTable() {
  const { data, error } = await supabase.from('leave_requests').select('*').limit(1);
  if (error) {
    console.error('Error fetching leave request:', error);
  } else {
    console.log('Leave Request columns:', Object.keys(data[0] || {}));
  }
}

inspectLeaveRequestsTable();
