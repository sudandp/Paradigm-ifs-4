import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
    const { data: orgStructure } = await supabase.from('organization_groups').select('*');
    console.log('Org structure:', orgStructure);

    const { data: arpitha } = await supabase.from('users').select('*').ilike('name', '%Arpitha%').single();
    console.log('Arpitha:', {
        id: arpitha?.id,
        name: arpitha?.name,
        society_id: arpitha?.society_id,
        society_name: arpitha?.society_name,
        organization_id: arpitha?.organization_id,
        organization_name: arpitha?.organization_name
    });
}
test().catch(console.error);
