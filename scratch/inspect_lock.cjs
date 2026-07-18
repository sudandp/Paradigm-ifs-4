const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectLock() {
  const { data: snapshots, error } = await supabase
    .from('attendance_month_snapshots')
    .select('id, employee_id, year, month, created_at, locked_by_name')
    .eq('year', 2026)
    .eq('month', 6);

  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${snapshots.length} monthly snapshots for June 2026.`);
    if (snapshots.length > 0) {
      console.log('Sample snapshot:');
      console.log(JSON.stringify(snapshots[0], null, 2));
    }
  }
}

inspectLock();
