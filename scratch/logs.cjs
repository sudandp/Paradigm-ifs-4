const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const userId = 'c96bc0e5-4b75-42a2-9f69-139de275ab7e';

async function run() {
    // Summary of devices that are currently ACTIVE for Poojashree
    const { data: active } = await supabase
        .from('user_devices')
        .select('id, device_identifier, device_name, device_type, status, last_used_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_used_at', { ascending: false });
    
    console.log('ACTIVE DEVICES:');
    active?.forEach(d => {
        console.log(`  [${d.device_type}] "${d.device_name}" | id: ${d.device_identifier}`);
        console.log(`    Last used: ${new Date(d.last_used_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
    });

    // Check if any pending device change requests exist from today
    const { data: reqs } = await supabase
        .from('device_change_requests')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending');
    
    console.log('\nPENDING DEVICE REQUESTS:', reqs?.length, reqs?.map(r => ({
        device: r.device_name, 
        id: r.device_identifier,
        requested_at: new Date(r.requested_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    })));
    
    // CHECK: The android OnePlus device last_used_at = 2026-07-22T08:38:36 = 14:08 IST
    // This means the device WAS used. But was it used to punch or just browse?
    // If the device_change_requests shows 'pending' for OnePlus today, then the punch was blocked
    
    // Also check if there's a device pending for today
    const { data: allReqs } = await supabase
        .from('device_change_requests')
        .select('id, device_name, device_identifier, status, requested_at')
        .eq('user_id', userId)
        .order('requested_at', { ascending: false })
        .limit(5);
    
    console.log('\nLAST 5 DEVICE REQUESTS:');
    allReqs?.forEach(r => {
        console.log(`  [${r.status}] "${r.device_name}" (${r.device_identifier}) @ ${new Date(r.requested_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
    });
}

run();
