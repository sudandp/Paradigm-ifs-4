
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmyafuhxlorbafbacywa.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchedules() {
  console.log("--- Inspecting Email Schedule Rules ---");
  const { data: rules, error: rulesErr } = await supabase
    .from('email_schedule_rules')
    .select('*');
  
  if (rulesErr) {
    console.error("Error fetching rules:", rulesErr);
    return;
  }

  rules.forEach(rule => {
    console.log(`\nRule: ${rule.name}`);
    console.log(`ID: ${rule.id}`);
    console.log(`Active: ${rule.is_active}`);
    console.log(`Trigger: ${rule.trigger_type}`);
    console.log(`Report: ${rule.report_type}`);
    console.log(`Config: ${JSON.stringify(rule.schedule_config)}`);
    console.log(`Last Sent: ${rule.last_sent_at}`);
  });

  console.log("\n--- Inspecting Recent Logs (Last 10) ---");
  const { data: logs, error: logsErr } = await supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (logsErr) {
    console.error("Error fetching logs:", logsErr);
    return;
  }

  logs.forEach(log => {
    console.log(`\nTime: ${log.created_at}`);
    console.log(`Recipient: ${log.recipient_email}`);
    console.log(`Subject: ${log.subject}`);
    console.log(`Status: ${log.status}`);
    console.log(`Error: ${log.error_message || 'None'}`);
  });
}

inspectSchedules();
