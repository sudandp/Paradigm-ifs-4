import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const queries = [
  { name: 'Shilpa M', date: '2026-04-02' },
  { name: 'Sudhan M', date: '2026-03-12' },
  { name: 'Anil', date: '2026-02-21' },
  { name: 'Sinchana KM', date: '2026-02-18' },
  { name: 'Sudhan M', date: '2026-02-06' },
  { name: 'Sinchana KM', date: '2026-01-29' },
  { name: 'Sudhan M', date: '2026-01-21' }
];

async function findLeaves() {
  console.log("Searching for second batch leave requests...");

  const { data: leaves, error } = await supabase
    .from('leave_requests')
    .select(`
      id,
      user_id,
      leave_type,
      start_date,
      end_date,
      status,
      reason,
      users!leave_requests_user_id_fkey(name)
    `);

  if (error) {
    console.error("Error fetching leaves:", error);
    return;
  }

  const results: any[] = [];
  queries.forEach(q => {
    const match = leaves?.find(l => {
      const name = (l.users?.name || '').toLowerCase().trim();
      const targetName = q.name.toLowerCase().trim();
      const isUserMatch = name.startsWith(targetName) || targetName.startsWith(name);
      const isDateMatch = l.start_date === q.date;
      return isUserMatch && isDateMatch;
    });
    if (match) {
      results.push(match);
    } else {
      console.log(`Could not find match for ${q.name} on ${q.date}`);
    }
  });

  console.log("\nFound matches in DB:");
  results.forEach(r => {
    console.log(`- ID: ${r.id}`);
    console.log(`  User: ${r.users?.name}`);
    console.log(`  Leave Type: ${r.leave_type}`);
    console.log(`  Dates: ${r.start_date} to ${r.end_date}`);
    console.log(`  Reason: ${r.reason}`);
  });
}

findLeaves().catch(console.error);
