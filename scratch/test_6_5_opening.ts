import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function set65Opening() {
    const userId = '216d264d-b20b-45a1-91b5-09cb47c781fb'; // Veerabhadra T M

    await supabase.from('users').update({
        comp_off_opening_balance: 6.5,
        comp_off_opening_date: '2026-07-01',
        updated_at: new Date().toISOString()
    }).eq('id', userId);

    console.log("Set comp_off_opening_balance = 6.5, comp_off_opening_date = '2026-07-01'");
}

set65Opening().catch(console.error);
