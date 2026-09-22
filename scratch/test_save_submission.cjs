const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const m = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : null;
};

const client = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_ANON_KEY'));

async function testResolution() {
  const employeeId = 'PARA-3618';
  // Check existing row
  const { data: existing, error } = await client
    .from('onboarding_submissions')
    .select('id, employee_id, status')
    .eq('employee_id', employeeId)
    .maybeSingle();

  if (error) {
    console.error('Error finding existing:', error);
    return;
  }
  console.log('Found existing row by employee_id:', existing);

  // Test updating with this ID
  const { data: updated, error: updateError } = await client
    .from('onboarding_submissions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .select('id, employee_id, updated_at')
    .single();

  if (updateError) {
    console.error('Update failed:', updateError);
  } else {
    console.log('Update succeeded without 23505:', updated);
  }
}

testResolution();
