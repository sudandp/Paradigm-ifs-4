import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkUserData() {
  const userId = '216d264d-b20b-45a1-91b5-09cb47c781fb'; // Veerabhadra T M

  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();

  console.log("Current DB Record for Veerabhadra T M:", {
    id: user.id,
    name: user.name,
    comp_off_opening_balance: user.comp_off_opening_balance,
    comp_off_opening_date: user.comp_off_opening_date,
    updated_at: user.updated_at
  });
}

checkUserData().catch(console.error);
