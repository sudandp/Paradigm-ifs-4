const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function surgicalRepair() {
    console.log('--- Surgical SMTP Repair ---');
    
    // 1. Fetch current config
    const { data: settings, error: fErr } = await supabase
        .from('settings')
        .select('email_config')
        .eq('id', 'singleton')
        .single();
    
    if (fErr) {
        console.error('Error fetching settings:', fErr);
        return;
    }

    const currentConfig = settings.email_config || {};
    console.log('Current Keys:', Object.keys(currentConfig));

    // 2. Merge missing fields WITHOUT overwriting existing ones
    const updatedConfig = {
        ...currentConfig,
        host: currentConfig.host || 'smtp.gmail.com',
        port: currentConfig.port || 465,
        secure: currentConfig.secure ?? true,
        enabled: currentConfig.enabled ?? true
    };

    // 3. Update back to DB
    const { error: uErr } = await supabase
        .from('settings')
        .update({ email_config: updatedConfig })
        .eq('id', 'singleton');
    
    if (uErr) {
        console.error('Error updating settings:', uErr);
    } else {
        console.log('Successfully surgically repaired SMTP configuration.');
    }
}

surgicalRepair().catch(console.error);
