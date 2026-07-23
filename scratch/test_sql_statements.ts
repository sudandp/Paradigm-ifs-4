import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkColumns() {
  const tables = [
    'api_rate_limits',
    'billing_configs',
    'client_nda_templates',
    'document_expiry_vault',
    'attendance_daily_status_log',
    'attendance_month_snapshots',
    'attendance_rule_versions',
    'email_logs',
    'gate_attendance_logs',
    'gate_users',
    'hrm_activity_feed',
    'hrm_call_logs',
    'inventory_items',
    'kiosk_devices',
    'payroll_snapshots',
    'reimbursement_claims',
    'security_audit_logs'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table}: ERROR -> ${error.message}`);
    } else {
      const sample = data && data[0] ? Object.keys(data[0]).join(', ') : 'EMPTY (table exists)';
      console.log(`Table ${table}: OK -> keys: [${sample}]`);
    }
  }
}

checkColumns().catch(console.error);
