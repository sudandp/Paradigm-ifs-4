import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testPunchOut() {
  const userId = 'ed8ce87f-1f28-4a3a-a319-4dc502add40d';
  console.log("Simulating punch-out for Venkatachalam...");
  
  const event = {
    user_id: userId,
    timestamp: new Date().toISOString(),
    type: 'punch-out',
    latitude: 12.9716, // dummy coordinates
    longitude: 77.5946,
    work_type: 'office'
  };

  const { data, error } = await supabase
    .from('attendance_events')
    .insert(event)
    .select();

  if (error) {
    console.error("FAILED to insert punch-out event:", error);
  } else {
    console.log("SUCCESS! Inserted event:", data);
  }
}

testPunchOut();
