/**
 * Find roles of employees showing BL/P incorrectly on 3rd Saturday
 * Then check which roles are missing from site mapping
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fmyafuhxlorbafbacywa.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Employees showing wrong BL/P
const targetNames = ['Kushal', 'Dabashish'];

async function main() {
  // 1. Find these employees and their roles (role is a FK to roles table)
  const { data: employees, error } = await supabase
    .from('users')
    .select('id, name, email, role_id, location_id, role:roles(id, display_name)')
    .or(targetNames.map(n => `name.ilike.%${n}%`).join(','))
    .limit(20);

  if (error) { console.error(error); process.exit(1); }

  console.log('=== Employees with potential wrong BL/P ===');
  employees.forEach(e => {
    const roleId = e.role_id || (e.role && e.role.id) || 'unknown';
    const roleName = (e.role && e.role.display_name) || e.role_id || 'unknown';
    console.log(`  Name: ${e.name} | Role ID: ${roleId} | Role Name: ${roleName} | Location: ${e.location}`);
  });

  // 2. Get current site role mapping
  const { data: settings } = await supabase
    .from('settings')
    .select('attendance_settings')
    .eq('id', 'singleton')
    .single();

  const config = settings?.attendance_settings?.missed_checkout_config || {};
  const roleMapping = config?.role_mapping || {};
  const currentSiteRoles = roleMapping?.site || [];

  console.log('=== Current Site Roles ===');
  currentSiteRoles.forEach(r => console.log(`  - ${r}`));

  // 3. Find which employee roles are NOT in site mapping
  console.log('\n=== Roles NOT in site mapping ===');
  const missingRoles = [];
  employees.forEach(e => {
    const roleId = e.role_id || (e.role && e.role.id) || null;
    const roleName = (e.role && e.role.display_name) || e.role_id || null;
    if (!roleId) return;
    const roleLower = roleId.toLowerCase();
    const inSite = currentSiteRoles.some(r => r.toLowerCase() === roleLower);
    const inOffice = (roleMapping?.office || []).some(r => r.toLowerCase() === roleLower);
    const inField = (roleMapping?.field || []).some(r => r.toLowerCase() === roleLower);
    if (!inSite) {
      console.log(`  ❌ "${roleName}" (id: ${roleId}) for ${e.name} → currently in ${inOffice ? 'OFFICE' : inField ? 'FIELD' : 'NONE'}`);
      missingRoles.push(roleId);
    } else {
      console.log(`  ✅ "${roleName}" (id: ${roleId}) for ${e.name} → already in SITE`);
    }
  });

  if (missingRoles.length === 0) {
    console.log('\nAll roles already in site mapping. Issue may be in DB role_mapping casing or settings versioning.');
    return;
  }

  // 4. Add missing roles to site
  console.log('\n=== Adding missing roles to site ===');
  const updatedSiteRoles = [...currentSiteRoles];
  for (const role of missingRoles) {
    const exists = updatedSiteRoles.some(r => r.toLowerCase() === role.toLowerCase());
    if (!exists) {
      updatedSiteRoles.push(role);
      console.log(`  ✓ Added: ${role}`);
    }
  }

  const updatedSettings = {
    ...settings.attendance_settings,
    missed_checkout_config: {
      ...config,
      role_mapping: { ...roleMapping, site: updatedSiteRoles }
    }
  };

  const { error: saveErr } = await supabase
    .from('settings')
    .update({ attendance_settings: updatedSettings })
    .eq('id', 'singleton');

  if (saveErr) { console.error('Save failed:', saveErr); process.exit(1); }

  console.log('\n✅ Done! Updated site roles:');
  updatedSiteRoles.forEach(r => console.log(`   - ${r}`));
}

main();
