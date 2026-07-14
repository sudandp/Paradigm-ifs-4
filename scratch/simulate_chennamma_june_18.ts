import { createClient } from '@supabase/supabase-js';
import { processEmployeeMonth } from '../utils/monthlyReportCalculations';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function toCamelCase(data: any): any {
  if (Array.isArray(data)) {
    return data.map(item => toCamelCase(item));
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const camelCased: Record<string, any> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
        let value = data[key];
        
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object') {
              value = parsed;
            }
          } catch (e) {}
        }
        
        camelCased[camelKey] = toCamelCase(value);
      }
    }
    return camelCased;
  }
  return data;
}

async function main() {
    const userId = "eabb1f4f-0699-4f0f-b2a0-0350d9e56ead"; // Chennamma
    const year = 2026;
    const month = 6;

    console.log("Fetching user profile...");
    const { data: dbUser } = await supabase.from('users').select('*, role:roles(display_name)').eq('id', userId).single();
    const roleData = dbUser.role;
    const rawRoleName = (Array.isArray(roleData) ? roleData[0]?.display_name : (roleData as any)?.display_name) || dbUser.role_id;
    const roleName = typeof rawRoleName === 'string' ? rawRoleName.toLowerCase().replace(/\s+/g, '_') : rawRoleName;
    const user = toCamelCase({ ...dbUser, role: roleName });

    const startStr = "2026-05-15";
    const endStr = "2026-06-30 23:59:59";

    console.log(`Querying events for user...`);
    const { data: rawEvents } = await supabase.from('attendance_events')
      .select('id, user_id, timestamp, type, work_type, latitude, longitude, location_id, location_name, device_id, checkout_note, attachment_url, is_manual, created_by, reason, is_ot, battery_level, device_name, ip_address, network_type, source, steps, travel_distance')
      .eq('user_id', userId)
      .gte('timestamp', startStr)
      .lte('timestamp', endStr)
      .order('timestamp', { ascending: true });

    const events = toCamelCase(rawEvents || []);

    const { data: rawLeaves } = await supabase.from('leave_requests').select('*').eq('user_id', userId);
    const leaves = toCamelCase(rawLeaves || []);

    const { data: rawSettings } = await supabase.from('settings').select('*').eq('id', 'singleton').single();
    const attendanceSettings = toCamelCase(rawSettings?.attendance_settings || {});

    const { data: rawHolidays } = await supabase.from('holidays').select('*');
    const holidays = toCamelCase(rawHolidays || []);

    const { data: rawRecurring } = await supabase.from('recurring_holidays').select('*');
    const recurringHolidays = toCamelCase(rawRecurring || []);

    const officeHolidays = holidays.filter((h: any) => h.type === 'office');
    const fieldHolidays = holidays.filter((h: any) => h.type === 'field');
    const siteHolidays = holidays.filter((h: any) => h.type === 'site');

    // Run processEmployeeMonth
    console.log("Running processEmployeeMonth for June 2026...");
    const report = processEmployeeMonth(
        user,
        events,
        leaves, // leaves
        [], // userHolidays
        year,
        month,
        officeHolidays,
        fieldHolidays,
        siteHolidays,
        recurringHolidays,
        leaves, // allLeaves
        user.role,
        [], // routePoints
        null, // versionedRules
        attendanceSettings,
        [] // scopedSettings
    );

    const day18 = report.dailyData.find(d => d.date === 18);
    console.log("\n--- Day 18 Results ---");
    console.log(JSON.stringify(day18, null, 2));
}

main().catch(console.error);
