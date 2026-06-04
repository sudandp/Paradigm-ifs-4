import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const employeeIds = [
  '6156dcf1-f6bb-4b5e-86d1-9236e6ec4a27', // Arpitha Nairy
  'c9ffc969-8f2b-48cf-914c-0f30a661ba6f', // Sinchana KM
  '2a82f0cc-effb-4576-917c-72408ea06b45', // Sanjay Ganapati Naik
  'd360ab98-6198-4e00-8efb-db7be5b50668', // Anil
  '94a4f34e-f4d0-42d5-b2c5-7b43419a3325'  // Shilpa M
];

async function inspectSnapshots() {
  console.log("Fetching snapshots for April/May 2026...");
  const { data: snapshots, error } = await supabase
    .from('attendance_month_snapshots')
    .select(`
      id,
      employee_id,
      year,
      month,
      locked_at,
      locked_by_name,
      summary
    `)
    .in('employee_id', employeeIds)
    .eq('year', 2026)
    .in('month', [4, 5]);

  if (error) {
    console.error('Error fetching snapshots:', error);
    return;
  }

  console.log(`Found ${snapshots?.length || 0} snapshots.`);
  snapshots?.forEach(s => {
    console.log(`- ID: ${s.id}, Employee: ${s.employee_id}, Year: ${s.year}, Month: ${s.month}`);
    console.log(`  Locked at: ${s.locked_at} by ${s.locked_by_name}`);
    console.log(`  Summary:`, s.summary);
  });
}

inspectSnapshots();
