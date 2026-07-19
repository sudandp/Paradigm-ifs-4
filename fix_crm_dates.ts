import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fmyafuhxlorbafbacywa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZteWFmdWh4bG9yYmFmYmFjeXdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjIyODU0NiwiZXhwIjoyMDc3ODA0NTQ2fQ.1wQC3L3gzGpZ2SwwQXMhXliZo_f7ye99vKEO7Q2iC5M';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: leads, error } = await supabase.from('crm_leads').select('id, created_at, stage_updated_at');
  if (error) {
    console.error('Error fetching leads:', error);
    return;
  }
  
  console.log(`Found ${leads.length} leads.`);
  let updatedCount = 0;
  
  for (const lead of leads) {
    if (!lead.stage_updated_at || !lead.created_at) continue;

    const createdAt = new Date(lead.created_at);
    const stageUpdated = new Date(lead.stage_updated_at);
    
    // Calculate difference in days
    const diffDays = Math.floor((stageUpdated.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // If stage_updated_at is wildly after created_at and it was essentially updated "today"
    const now = new Date();
    const isStageRecent = (now.getTime() - stageUpdated.getTime()) < 48 * 60 * 60 * 1000;
    const isCreatedOld = (now.getTime() - createdAt.getTime()) > 48 * 60 * 60 * 1000;
    
    if (isStageRecent && isCreatedOld) {
      console.log(`Fixing lead: ${lead.id} (Created: ${lead.created_at}, Stage: ${lead.stage_updated_at})`);
      await supabase.from('crm_leads').update({ stage_updated_at: lead.created_at }).eq('id', lead.id);
      updatedCount++;
    }
  }
  
  console.log(`Successfully fixed ${updatedCount} leads in the database!`);
}

run();
