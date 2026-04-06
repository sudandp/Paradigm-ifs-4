const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function linkTemplate() {
    console.log('--- Linking Monthly Report V2 to Template ---');
    
    // 1. Get the template ID for "Monthly Attendance Report"
    const { data: template, error: tErr } = await supabase
        .from('email_templates')
        .select('id')
        .eq('name', 'Monthly Attendance Report')
        .single();
    
    if (tErr) {
        console.error('Error finding template:', tErr);
        return;
    }
    console.log('Found Template ID:', template.id);

    // 2. Update the rule "Monthly Report V2"
    const { data: rules, error: rErr } = await supabase
        .from('email_schedule_rules')
        .update({ 
            template_id: template.id,
            report_type: 'attendance_monthly',
            is_active: true
        })
        .ilike('name', 'Monthly Report%'); // Update both if multiple exist to be safe
    
    if (rErr) {
        console.error('Error updating rule:', rErr);
    } else {
        console.log('Successfully linked rule to template.');
    }
}

linkTemplate().catch(console.error);
