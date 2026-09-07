/**
 * Deletes all attendance_events for user "Sudhan" (IOT Architect)
 * for the date 2026-09-07 (today).
 * 
 * Run with: npx tsx scratch/delete_sudhan_attendance.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_DATE = '2026-09-07'; // Sep 7, 2026
const TARGET_NAME = 'Sudhan'; // partial match

async function main() {
    // Step 1: Find the user
    const { data: users, error: userErr } = await supabase
        .from('users')
        .select('id, name, role')
        .ilike('name', `%${TARGET_NAME}%`);

    if (userErr) { console.error('❌ Failed to find user:', userErr.message); return; }
    if (!users?.length) { console.error('❌ No user found matching:', TARGET_NAME); return; }

    console.log('🔍 Matching users:');
    users.forEach(u => console.log(`  - ${u.id} | ${u.name} | ${u.role}`));

    // If multiple users found, pick the one with role containing 'iot' or use first
    const targetUser = users.find(u =>
        u.role?.toLowerCase().includes('iot') ||
        u.name?.toLowerCase() === 'sudhan'
    ) || users[0];

    console.log(`\n✅ Targeting: ${targetUser.name} (${targetUser.role}) — ID: ${targetUser.id}`);

    // Step 2: Fetch all events for that user on the target date
    const dayStart = `${TARGET_DATE}T00:00:00.000Z`;
    const dayEnd   = `${TARGET_DATE}T23:59:59.999Z`;

    const { data: events, error: fetchErr } = await supabase
        .from('attendance_events')
        .select('id, type, timestamp, location_name, work_type')
        .eq('user_id', targetUser.id)
        .gte('timestamp', dayStart)
        .lte('timestamp', dayEnd)
        .order('timestamp', { ascending: true });

    if (fetchErr) { console.error('❌ Failed to fetch events:', fetchErr.message); return; }
    if (!events?.length) { console.log('ℹ️ No attendance events found for this user on', TARGET_DATE); return; }

    console.log(`\n📋 Found ${events.length} event(s) to delete:`);
    events.forEach(e => {
        const t = new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        console.log(`  - [${e.id}] ${e.type.padEnd(12)} @ ${t}  | ${e.location_name || '—'} | workType: ${e.work_type || 'office'}`);
    });

    // Step 3: Delete them
    const ids = events.map(e => e.id);
    const { error: deleteErr } = await supabase
        .from('attendance_events')
        .delete()
        .in('id', ids);

    if (deleteErr) {
        console.error('\n❌ Delete FAILED:', deleteErr.message);
    } else {
        console.log(`\n✅ Successfully deleted ${ids.length} attendance event(s) for ${targetUser.name} on ${TARGET_DATE}`);
    }
}

main().catch(console.error);
