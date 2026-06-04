import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const targetIds = [
  '83dad628-5e2f-4fce-9d02-7bb1606edece', // Shilpa M (2 Apr)
  'e1666a0c-d443-4e6c-afbd-a22bf83d68e6', // Sudhan M (12 Mar)
  'c60e0e51-5ef4-4c5c-b85a-8b427b315b56', // Anil (21 Feb)
  'de3ff984-b9ac-4ca6-a2e8-eb63c455cbf5', // Sinchana KM (18 Feb)
  '71ad5429-a212-4540-b213-fc8117a925d9', // Sudhan M (6 Feb)
  'c30bbdf6-1cd3-4fe9-9d2f-d66da2aa42f9', // Sinchana KM (29 Jan)
  '23f266a6-19ef-4ad0-9c58-38009762978d'  // Sudhan M (21 Jan)
];

async function updateSecondBatch() {
  console.log("Updating second batch leave requests...");

  // 1. Fetch current status of these requests
  const { data: beforeData, error: fetchErr } = await supabase
    .from('leave_requests')
    .select(`
      id,
      leave_type,
      reason,
      start_date,
      end_date,
      users!leave_requests_user_id_fkey(name)
    `)
    .in('id', targetIds);

  if (fetchErr) {
    console.error("Error fetching leaves before update:", fetchErr);
    return;
  }

  console.log("\nBefore Update:");
  beforeData?.forEach(l => {
    console.log(`- ID: ${l.id}, User: ${l.users?.name}, Type: ${l.leave_type}, Dates: ${l.start_date} to ${l.end_date}, Reason: ${l.reason}`);
  });

  // 2. Perform the update
  const { data: afterData, error: updateErr } = await supabase
    .from('leave_requests')
    .update({ leave_type: 'Sick' })
    .in('id', targetIds)
    .select(`
      id,
      leave_type,
      reason,
      start_date,
      end_date,
      users!leave_requests_user_id_fkey(name)
    `);

  if (updateErr) {
    console.error("Error updating leaves:", updateErr);
    return;
  }

  console.log("\nAfter Update:");
  afterData?.forEach(l => {
    console.log(`- ID: ${l.id}, User: ${l.users?.name}, Type: ${l.leave_type}, Dates: ${l.start_date} to ${l.end_date}, Reason: ${l.reason}`);
  });

  console.log("\nSuccessfully updated second batch of 7 leave requests to 'Sick' leave type.");
}

updateSecondBatch().catch(console.error);
