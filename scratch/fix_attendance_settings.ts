import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    console.log("=== Fetching current settings row ===");
    const { data: settings, error: fetchError } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'singleton')
        .maybeSingle();

    if (fetchError) {
        console.error("Fetch error:", fetchError);
        return;
    }

    if (!settings) {
        console.error("Settings singleton row not found.");
        return;
    }

    const outerSettings = settings.attendance_settings;
    if (!outerSettings) {
        console.error("No attendance_settings found in settings row.");
        return;
    }

    console.log("Outer settings keys:", Object.keys(outerSettings));

    const innerSettings = outerSettings.attendance_settings || outerSettings.attendanceSettings;
    if (!innerSettings) {
        console.log("No nested attendance_settings found. The structure might already be correct or flat.");
        return;
    }

    console.log("Nested inner settings found! Keys:", Object.keys(innerSettings));
    
    // We will update the settings row with the innerSettings as the new attendance_settings.
    console.log("Updating database settings...");
    const { error: updateError } = await supabase
        .from('settings')
        .update({
            attendance_settings: innerSettings
        })
        .eq('id', 'singleton');

    if (updateError) {
        console.error("Failed to update database:", updateError);
        return;
    }

    console.log("Database update successful!");

    // Verification
    console.log("=== Verifying updated settings ===");
    const { data: verifiedSettings, error: verifyError } = await supabase
        .from('settings')
        .select('attendance_settings')
        .eq('id', 'singleton')
        .maybeSingle();

    if (verifyError || !verifiedSettings) {
        console.error("Failed to verify:", verifyError);
        return;
    }

    console.log("New attendance_settings keys:", Object.keys(verifiedSettings.attendance_settings || {}));
    console.log("New attendance_settings.missed_checkout_config:", verifiedSettings.attendance_settings?.missed_checkout_config);
}

main().catch(console.error);
