
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function applyFix() {
    console.log('Applying notification rules fix...');

    const rules = [
        { event_type: 'punch_unlock_request', recipient_role: 'direct_manager', is_enabled: true, send_alert: true, send_push: true },
        { event_type: 'punch_unlock_request', recipient_role: 'admin', is_enabled: true, send_alert: true, send_push: true },
        { event_type: 'ot_punch', recipient_role: 'direct_manager', is_enabled: true, send_alert: true, send_push: true },
        { event_type: 'ot_punch', recipient_role: 'admin', is_enabled: true, send_alert: true, send_push: true }
    ];

    for (const rule of rules) {
        // Try to delete first to avoid duplicates if no unique constraint exists
        await supabase
            .from('notification_rules')
            .delete()
            .match({ event_type: rule.event_type, recipient_role: rule.recipient_role });

        const { error } = await supabase
            .from('notification_rules')
            .insert(rule);
        
        if (error) {
            console.error(`Error applying rule ${rule.event_type} for ${rule.recipient_role}:`, error);
        } else {
            console.log(`Applied rule ${rule.event_type} for ${rule.recipient_role}`);
        }
    }
}

applyFix();
