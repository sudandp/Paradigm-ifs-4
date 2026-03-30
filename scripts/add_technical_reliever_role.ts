
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRole() {
    console.log("Checking for 'technical_reliever' role...");
    const { data, error } = await supabase
        .from('roles')
        .select('id')
        .eq('id', 'technical_reliever');
    
    if (error) {
        console.error("Error checking role:", error.message);
        return;
    }
    
    if (data && data.length > 0) {
        console.log("Role 'technical_reliever' already exists in the database.");
    } else {
        console.log("Role 'technical_reliever' does NOT exist in the database. Adding it...");
        const { error: insertError } = await supabase
            .from('roles')
            .upsert({
                id: 'technical_reliever',
                display_name: 'Technical Reliever',
                permissions: ['create_enrollment', 'view_own_attendance', 'apply_for_leave', 'access_support_desk']
            });
        
        if (insertError) {
            console.error("Error adding role:", insertError.message);
        } else {
            console.log("Role 'technical_reliever' successfully added to the database.");
        }
    }
}

checkRole();
