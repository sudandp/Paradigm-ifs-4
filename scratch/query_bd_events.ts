import { createClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const IST_OFFSET = 5.5 * 60 * 60 * 1000;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function queryBDData() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: usersRes } = await supabase.from('users').select('id, name, role:roles(display_name)').eq('is_blocked', false);
  const bdUsers = (usersRes || []).filter((u: any) => {
    const roleName = (Array.isArray(u.role) ? u.role[0]?.display_name : u.role?.display_name) || '';
    return roleName.toLowerCase() === 'business developer' || roleName.toLowerCase() === 'business_developer';
  });

  console.log('=== BUSINESS DEVELOPER USERS ===');
  console.log(JSON.stringify(bdUsers, null, 2));

  for (const dateOffset of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const targetDate = subDays(new Date(), dateOffset);
    const targetDateIST = new Date(targetDate.getTime() + IST_OFFSET);
    const dateStr = format(targetDateIST, 'yyyy-MM-dd');
    
    const startStr = `${dateStr}T00:00:00.000Z`;
    const endStr = `${dateStr}T23:59:59.999Z`;

    for (const bd of bdUsers) {
      const { data: events } = await supabase
        .from('attendance_events')
        .select('*')
        .eq('user_id', bd.id)
        .gte('timestamp', startStr)
        .lte('timestamp', endStr)
        .order('timestamp', { ascending: true });

      const { data: calls } = await supabase
        .from('crm_followups')
        .select('*')
        .eq('created_by', bd.id)
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      const { data: leads } = await supabase
        .from('crm_leads')
        .select('*')
        .or(`created_by.eq.${bd.id},assigned_to.eq.${bd.id}`)
        .gte('created_at', startStr)
        .lte('created_at', endStr);

      if ((events && events.length > 0) || (calls && calls.length > 0) || (leads && leads.length > 0)) {
        console.log(`\n📅 DATE: ${dateStr} (${format(targetDateIST, 'EEEE')}) | BD: ${bd.name}`);
        console.log(`--- Attendance Events (${events?.length || 0}) ---`);
        events?.forEach(e => {
          const istTime = format(new Date(new Date(e.timestamp).getTime() + IST_OFFSET), 'hh:mm:ss a');
          console.log(`  • Type: ${e.type} | Time IST: ${istTime} | Distance: ${e.travel_distance || 0} km | Lat/Lng: ${e.latitude},${e.longitude}`);
        });

        console.log(`--- CRM Followups / Calls (${calls?.length || 0}) ---`);
        calls?.forEach(c => {
          console.log(`  • Type: ${c.type} | Lead ID: ${c.lead_id} | Created At: ${c.created_at}`);
        });

        console.log(`--- CRM Leads Created (${leads?.length || 0}) ---`);
        leads?.forEach(l => {
          console.log(`  • Company: ${l.company_name} | Contact: ${l.contact_person} | Status: ${l.status}`);
        });
      }
    }
  }
}

queryBDData().catch(console.error);
