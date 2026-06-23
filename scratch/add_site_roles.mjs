/**
 * Script to add technical site staff roles to the Site Staff category
 * in the attendance settings roleMapping.
 *
 * Roles to add to site: TECHNICIAN, TECHNICAL SUPERVISOR, TECHNICAL RELIEVER, AFM - TECHNICAL
 *
 * Run: node scratch/add_site_roles.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fmyafuhxlorbafbacywa.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// New roles to add to site category (role IDs / names as stored in roleMapping.site)
const ROLES_TO_ADD_TO_SITE = [
  'TECHNICIAN',
  'TECHNICAL SUPERVISOR', 
  'TECHNICAL RELIEVER',
  'AFM - TECHNICAL',
];

async function main() {
  // 1. Fetch current settings
  const { data, error } = await supabase
    .from('settings')
    .select('attendance_settings')
    .eq('id', 'singleton')
    .single();

  if (error) {
    console.error('Failed to fetch settings:', error);
    process.exit(1);
  }

  const settings = data.attendance_settings;
  console.log('Current missedCheckoutConfig:', JSON.stringify(settings?.missed_checkout_config || settings?.missedCheckoutConfig, null, 2));

  // Support both snake_case (DB) and camelCase
  const config = settings?.missed_checkout_config || settings?.missedCheckoutConfig || {};
  const roleMapping = config?.role_mapping || config?.roleMapping || {};

  console.log('\nCurrent Site roles:', roleMapping?.site || roleMapping?.Site || []);

  // Get existing site roles array
  const currentSiteRoles = roleMapping?.site || roleMapping?.Site || [];

  // Add new roles (avoid duplicates, case-insensitive check)
  const updatedSiteRoles = [...currentSiteRoles];
  for (const role of ROLES_TO_ADD_TO_SITE) {
    const exists = updatedSiteRoles.some(r => r.toLowerCase() === role.toLowerCase());
    if (!exists) {
      updatedSiteRoles.push(role);
      console.log(`  ✓ Adding: ${role}`);
    } else {
      console.log(`  - Already exists: ${role}`);
    }
  }

  // Build updated config
  const updatedRoleMapping = { ...roleMapping, site: updatedSiteRoles };
  const updatedConfig = {
    ...config,
    role_mapping: updatedRoleMapping,
  };
  // Remove camelCase duplicate if present
  delete updatedConfig.roleMapping;

  const updatedSettings = {
    ...settings,
    missed_checkout_config: updatedConfig,
  };
  delete updatedSettings.missedCheckoutConfig;

  console.log('\nUpdated Site roles:', updatedSiteRoles);

  // 2. Save back
  const { error: updateError } = await supabase
    .from('settings')
    .update({ attendance_settings: updatedSettings })
    .eq('id', 'singleton');

  if (updateError) {
    console.error('Failed to update settings:', updateError);
    process.exit(1);
  }

  console.log('\n✅ Settings updated successfully! Site staff now includes:');
  updatedSiteRoles.forEach(r => console.log(`   - ${r}`));
}

main();
