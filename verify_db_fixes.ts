import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://fmyafuhxlorbafbacywa.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, serviceKey);

async function runVerification() {
  console.log("=== SUPABASE DATABASE TABLE & COLUMN VERIFICATION ===");
  
  // 1. travel_logs check
  const { error: travelErr } = await supabase
    .from('travel_logs')
    .select('id, user_id, travel_date, total_km')
    .limit(1);
    
  if (travelErr) {
    console.error("❌ travel_logs query failed:", travelErr.message);
  } else {
    console.log("✅ travel_logs: total_km column exists!");
  }

  // 2. route_history check
  const { error: routeErr } = await supabase
    .from('route_history')
    .select('id, user_id, latitude, longitude, timestamp')
    .limit(1);

  if (routeErr) {
    console.error("❌ route_history query failed:", routeErr.message);
  } else {
    console.log("✅ route_history: table accessible!");
  }

  // 3. notifications check
  const { data: notifData, error: notifErr } = await supabase
    .from('notifications')
    .select('id, user_id, message, is_read, recipient_id, created_at')
    .limit(1);

  if (notifErr) {
    console.error("❌ notifications query failed:", notifErr.message);
  } else {
    console.log("✅ notifications: basic columns (user_id, recipient_id, message) accessible!");
  }
}

runVerification().catch(console.error);
