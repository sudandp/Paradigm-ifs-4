import { supabase } from './services/supabase';


async function run() {
  const { data: users } = await supabase.from('users').select('id, name, email').ilike('email', '%nakulalvar%');
  if (!users || users.length === 0) return console.log('User not found');
  
  const userId = users[0].id;
  console.log('User ID:', userId, 'Name:', users[0].name);

  const { data: allLeads } = await supabase.from('crm_leads').select('id, status, created_by, assigned_to, company_name, created_at').or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
  
  console.log('TOTAL_LEADS_COUNT:', allLeads ? allLeads.length : 0);
  
  const stages: Record<string, number> = {
    'New Lead': 0,
    'Contacted': 0,
    'Site Visit Planned': 0,
    'Survey Completed': 0,
    'Proposal Sent': 0,
    'Negotiation': 0,
    'Won': 0,
    'Lost': 0
  };

  (allLeads || []).forEach(l => {
    if (stages[l.status] !== undefined) stages[l.status]++;
    else stages[l.status] = (stages[l.status] || 0) + 1;
  });

  console.log('--- STAGE COUNTS ---');
  console.log(JSON.stringify(stages, null, 2));

  const startStr = '2026-07-30T18:30:00Z';
  const endStr = '2026-07-31T18:30:00Z';

  const { data: followupsYesterday } = await supabase.from('crm_followups').select('*').gte('created_at', startStr).lt('created_at', endStr);
  
  const bdFollowups = (followupsYesterday || []).filter(f => f.created_by === userId || (allLeads || []).some(l => l.id === f.lead_id));
  console.log('YESTERDAY_FOLLOWUPS_COUNT:', bdFollowups.length);

  const { data: eventsYesterday } = await supabase.from('attendance_events').select('*').eq('user_id', userId).gte('timestamp', startStr).lt('timestamp', endStr);
  const siteIns = (eventsYesterday || []).filter(e => e.type === 'site-in');
  console.log('YESTERDAY_SITE_IN_COUNT:', siteIns.length);
}

run();
