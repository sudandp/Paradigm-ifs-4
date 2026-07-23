import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const userId = '5321c6f6-578e-4168-9da8-060148e1587b'; // Sudhan M

    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    const { data: logs } = await supabase.from('comp_off_logs').select('*').eq('user_id', userId);
    const { data: leaveRequests } = await supabase.from('leave_requests').select('*').eq('user_id', userId);

    console.log("=== USER PROFILE ===");
    console.log({
        name: user?.name,
        email: user?.email,
        comp_off_opening_balance: user?.comp_off_opening_balance,
        comp_off_opening_date: user?.comp_off_opening_date,
        ot_hours_bank: user?.ot_hours_bank
    });

    console.log("\n=== COMP OFF LOGS (EARNED / GRANTED) ===");
    console.log(JSON.stringify(logs, null, 2));

    console.log("\n=== COMP OFF TYPE LEAVE REQUESTS (TAKEN / USED) ===");
    const compOffLeaves = leaveRequests?.filter(l => l.leave_type === 'Comp Off');
    console.log(JSON.stringify(compOffLeaves, null, 2));

    // Also check if there are other leaves or adjustments
    console.log("\n=== LEAVE REQUESTS SUMMARY BY TYPE & STATUS ===");
    const summary: Record<string, { total: number, approved: number, pending: number, rejected: number, totalDaysApproved: number }> = {};
    
    leaveRequests?.forEach(l => {
        const type = l.leave_type || 'Unknown';
        if (!summary[type]) {
            summary[type] = { total: 0, approved: 0, pending: 0, rejected: 0, totalDaysApproved: 0 };
        }
        summary[type].total++;
        if (l.status === 'approved') {
            summary[type].approved++;
            // Calculate days
            let days = 1;
            if (l.start_date && l.end_date) {
                const s = new Date(l.start_date);
                const e = new Date(l.end_date);
                const diffTime = Math.abs(e.getTime() - s.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                days = l.days_count || l.total_days || l.half_day ? 0.5 : diffDays;
            }
            summary[type].totalDaysApproved += days;
        } else if (l.status?.includes('pending')) {
            summary[type].pending++;
        } else if (l.status === 'rejected') {
            summary[type].rejected++;
        }
    });

    console.log(JSON.stringify(summary, null, 2));
}

main().catch(console.error);
