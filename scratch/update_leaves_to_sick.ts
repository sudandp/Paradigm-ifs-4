import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const targetIds = [
  '1be6e650-ec23-4dd6-910c-ca435d4484f8', // Arpitha Nairy (29 May)
  'bbcfc9f7-efdc-478c-b739-5d3ddcce5440', // Shilpa M (3 Apr)
  '1898f29f-6aeb-4cfb-a6fb-2163878c5cce', // Anil (9 Apr)
  'f023a0da-b64a-4891-9ade-f0666b1d198a', // Sinchana KM (21 Apr, half)
  '2a43c55e-260e-41cb-a17c-b3899a3ed61b', // Sinchana KM (21 Apr, half)
  '504e84de-39d3-40f1-8ec5-1a8d74f9b335'  // Sanjay Ganapati Naik (18 Apr)
];

async function updateLeaves() {
  console.log("Updating leave requests...");
  
  // 1. Fetch current status of these requests
  const { data: beforeData, error: fetchErr } = await supabase
    .from('leave_requests')
    .select('id, leave_type, reason, start_date, end_date')
    .in('id', targetIds);

  if (fetchErr) {
    console.error("Error fetching leaves before update:", fetchErr);
    return;
  }

  console.log("\nBefore Update:");
  beforeData?.forEach(l => {
    console.log(`- ID: ${l.id}, Type: ${l.leave_type}, Dates: ${l.start_date} to ${l.end_date}, Reason: ${l.reason}`);
  });

  // 2. Perform the update
  const { data: afterData, error: updateErr } = await supabase
    .from('leave_requests')
    .update({ leave_type: 'Sick' })
    .in('id', targetIds)
    .select('id, leave_type, reason, start_date, end_date');

  if (updateErr) {
    console.error("Error updating leaves:", updateErr);
    return;
  }

  console.log("\nAfter Update:");
  afterData?.forEach(l => {
    console.log(`- ID: ${l.id}, Type: ${l.leave_type}, Dates: ${l.start_date} to ${l.end_date}, Reason: ${l.reason}`);
  });

  console.log("\nSuccessfully updated all 6 leave requests to 'Sick' leave type.");
}

updateLeaves().catch(console.error);
