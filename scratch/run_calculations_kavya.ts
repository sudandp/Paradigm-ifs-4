import { createClient } from '@supabase/supabase-js';
import { processEmployeeMonth, resolveUserRules } from '../utils/monthlyReportCalculations';
import { getStaffCategory } from '../utils/attendanceCalculations';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper function equivalent to toCamelCase in the app
function toCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(v => toCamelCase(v));
  } else if (obj !== null && obj !== undefined && obj.constructor === Object) {
    return Object.keys(obj).reduce(
      (result, key) => ({
        ...result,
        [key.replace(/([-_][a-z])/g, group =>
          group.toUpperCase().replace('-', '').replace('_', '')
        )]: toCamelCase(obj[key]),
      }),
      {}
    );
  }
  return obj;
}

async function main() {
    const userId = "07f61efd-24f2-457e-84b3-d8dafcb556c6"; // Kavya M

    console.log("Fetching user profile directly...");
    const { data: dbUser, error: uErr } = await supabase
        .from('users')
        .select('*, role:roles(display_name), companies!users_society_id_fkey(location)')
        .eq('id', userId)
        .single();
        
    if (uErr || !dbUser) {
        console.error("User fetch error:", uErr);
        return;
    }

    console.log("Database user row:", JSON.stringify(dbUser, null, 2));

    // Recreate the getUsers mapping
    const roleData = dbUser.role;
    const rawRoleName = (Array.isArray(roleData) ? roleData[0]?.display_name : (roleData as any)?.display_name) || dbUser.role_id;
    const roleName = typeof rawRoleName === 'string' ? rawRoleName.toLowerCase().replace(/\s+/g, '_') : rawRoleName;
    
    let user = toCamelCase({ ...dbUser, role: roleName });
    if (dbUser.companies) {
      const compLocation = Array.isArray(dbUser.companies) ? dbUser.companies[0]?.location : dbUser.companies?.location;
      if (compLocation) {
        user.location = compLocation;
      }
    }

    console.log("\nFrontend-mapped User Object:");
    console.log(JSON.stringify(user, null, 2));

    const year = 2026;
    const month = 7;
    
    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(year, month - 1, 31, 23, 59, 59).toISOString();

    const [
        events,
        leaves,
        userHolidays,
        settings,
        recurringHolidays,
        officeHolidays,
        fieldHolidays,
        siteHolidays
    ] = await Promise.all([
        supabase.from('attendance_events').select('*').eq('user_id', userId).gte('timestamp', start).lte('timestamp', end),
        supabase.from('leave_requests').select('*').eq('user_id', userId),
        supabase.from('user_holidays').select('*').eq('user_id', userId),
        supabase.from('settings').select('*').eq('id', 'singleton').single(),
        supabase.from('recurring_holidays').select('*'),
        supabase.from('holidays').select('*'),
        supabase.from('holidays').select('*'),
        supabase.from('holidays').select('*')
    ]);

    // Camelcase attendance settings
    const attendanceSettings = toCamelCase(settings.data?.attendance_settings || {});
    
    console.log("\nCalling getStaffCategory with frontend parameters...");
    const category = getStaffCategory(
        user.role,
        user.societyId || user.organizationId,
        attendanceSettings
    );
    console.log("Resolved Category:", category);

    const rules = resolveUserRules(
        user,
        user.role,
        attendanceSettings,
        []
    );
    console.log("Resolved Rules for Category:", category, "geofencingEnabled =", rules?.geofencingEnabled);

    // Let's run processEmployeeMonth
    const report = processEmployeeMonth(
        user,
        events.data?.map((e: any) => ({
            id: e.id,
            userId: e.user_id,
            timestamp: e.timestamp,
            type: e.type,
            workType: e.work_type,
            latitude: e.latitude,
            longitude: e.longitude,
            locationId: e.location_id,
            locationName: e.location_name
        })) || [],
        leaves.data || [],
        userHolidays.data || [],
        year,
        month,
        officeHolidays.data || [],
        fieldHolidays.data || [],
        siteHolidays.data || [],
        recurringHolidays.data || [],
        leaves.data || [],
        user.role,
        [],
        null,
        attendanceSettings,
        []
    );

    console.log("\n--- Report Calculations Results ---");
    console.log("Present days:", report.presentDays);
    console.log("Absent days:", report.absentDays);
    console.log("Week Offs:", report.weekOffs);
    console.log("First few days of report:");
    report.dailyData.slice(0, 14).forEach(d => {
        console.log(`Day ${d.date}: Status = ${d.status}, In = ${d.inTime}, Out = ${d.outTime}`);
    });
}

main().catch(console.error);
