import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// We want to fetch the settings and user profile to calculate the balance of Poojashree S
async function main() {
    // Fetch user profile
    const { data: userProfile, error: userError } = await admin
  .from('users')
  .select('*')
  .ilike('name', '%Poojashree%')
  .single();
    console.log("User Profile before update:", userProfile);
    
    if (userProfile) {
        await admin.from('users').update({ child_care_leave_opening_balance: 6 }).eq('id', userProfile.id);
        console.log("Updated opening balance to 6");
    }
    
    const userId = userProfile?.id;

    // Fetch leave requests
    const currentYear = new Date().getFullYear();
    const accrualYearStart = new Date(`${currentYear}-01-01T00:00:00`);
    
    // Check earned leave calculation
    const rules = {
        earnedLeaveAccrual: { amountEarned: 1.5, daysRequired: 30 },
        useWorkedDaysForEarnedLeave: true // I will fetch this from the DB actually
    };
    
    const { data: attendanceSettings } = await admin.from('attendance_settings').select('rules').single();
    const activeRules = attendanceSettings?.rules || {};
    console.log("Earned Leave Rules:", {
        amountEarned: activeRules.earnedLeaveAccrual?.amountEarned,
        daysRequired: activeRules.earnedLeaveAccrual?.daysRequired,
        useWorkedDaysForEarnedLeave: activeRules.useWorkedDaysForEarnedLeave,
        annualEarnedLeaves: activeRules.annualEarnedLeaves
    });

    const openingBalance = userProfile.earned_leave_opening_balance || 0;
    const openingDate = userProfile.earned_leave_opening_date || `${currentYear}-01-01`;
    console.log("EL Opening:", openingBalance, "Date:", openingDate);

    // Let's count her approved Earned Leaves to see how many she used.
    const { data: leaves } = await admin.from('leave_requests').select('*').eq('user_id', userId).eq('status', 'approved');
    let elUsed = 0;
    leaves?.forEach((l: any) => {
        if (l.leave_type === 'Earned') {
            const start = new Date(l.start_date);
            const end = new Date(l.end_date);
            // Rough calculation
            let days = 0;
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                days++;
            }
            if (l.is_half_day) days = 0.5;
            elUsed += days;
        }
    });
    console.log("EL Used roughly:", elUsed);

}

main().catch(console.error);
