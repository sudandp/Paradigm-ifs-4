const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function repairSettings() {
    console.log('--- Repairing SMTP Settings ---');
    
    const { data: settings, error: fErr } = await supabase
        .from('settings')
        .select('email_config')
        .eq('id', 'singleton')
        .single();
    
    if (fErr) {
        console.error('Error fetching settings:', fErr);
        return;
    }

    const config = settings.email_config || {};
    
    // Add missing host if not present (assuming gmail based on context)
    if (!config.host) {
        config.host = 'smtp.gmail.com';
        config.port = 465;
        config.secure = true;
    }

    const { error: uErr } = await supabase
        .from('settings')
        .update({ email_config: config })
        .eq('id', 'singleton');
    
    if (uErr) {
        console.error('Error updating settings:', uErr);
    } else {
        console.log('Successfully repaired SMTP configuration in database.');
        console.log('Updated Config:', JSON.stringify(config, null, 2));
    }
}

repairSettings().catch(console.error);
