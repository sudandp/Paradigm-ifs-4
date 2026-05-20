import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env' });
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local', override: true });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function update() {
  const rolesToUpdate = ['admin', 'hr', 'developer', 'management'];
  
  for (const roleId of rolesToUpdate) {
    const { data: roleData, error: fetchError } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single();
      
    if (fetchError) {
      console.error(`Failed to fetch role ${roleId}:`, fetchError);
      continue;
    }
    
    const permissions = roleData.permissions || [];
    if (!permissions.includes('view_referrals')) {
      permissions.push('view_referrals');
      const { error: updateError } = await supabase
        .from('roles')
        .update({ permissions })
        .eq('id', roleId);
        
      if (updateError) {
        console.error(`Failed to update role ${roleId}:`, updateError);
      } else {
        console.log(`Successfully added 'view_referrals' to role ${roleId}`);
      }
    } else {
      console.log(`Role ${roleId} already has 'view_referrals' permission`);
    }
  }
}

update();
