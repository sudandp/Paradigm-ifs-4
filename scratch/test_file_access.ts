
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function test() {
    const bucket = 'onboarding-documents';
    const storagePath = 'documents/5321c6f6-578e-4168-9da8-060148e1587b/1775732882179/PIFS EPF -CERTIFICATE_ALLOTMENT.pdf';
    
    console.log('--- Testing Decoded Path ---');
    const { data: data1, error: error1 } = await supabase.storage.from(bucket).download(storagePath);
    if (error1) {
        console.error('Decoded Path Error:', error1.message);
    } else {
        console.log('Decoded Path Success:', data1.size, 'bytes');
    }

    console.log('\n--- Testing Encoded Path (encodeURIComponent) ---');
    const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');
    console.log('Encoded path:', encodedPath);
    const { data: data2, error: error2 } = await supabase.storage.from(bucket).download(encodedPath);
    if (error2) {
        console.error('Encoded Path Error:', error2.message);
    } else {
        console.log('Encoded Path Success:', data2.size, 'bytes');
    }
    
    console.log('\n--- Testing Public URL Fetch ---');
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodedPath}`;
    console.log('Fetching:', publicUrl);
    try {
        const res = await fetch(publicUrl);
        if (res.ok) {
            console.log('Public URL Success:', res.status);
        } else {
            console.log('Public URL Error:', res.status, await res.text());
        }
    } catch (e) {
        console.error('Public URL Fetch Exception:', e);
    }
}

test();
