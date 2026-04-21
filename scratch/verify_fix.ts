
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifyLogic(bucket: string, storagePath: string) {
    console.log(`\n--- Testing Path: ${storagePath} ---`);
    
    // Ensure we have the raw decoded path (simulating what the server does)
    const decodedPath = decodeURIComponent(storagePath);
    console.log(`Decoded path: ${decodedPath}`);

    // Step 1: Try direct match (The fix: DON'T encode before calling download)
    let { data, error } = await supabase.storage.from(bucket).download(decodedPath);

    if (error) {
        console.warn(`Direct match failed: ${error.message}. Attempting Smart Fallback...`);
        
        // Step 2: Smart Fallback
        const pathParts = decodedPath.split('/');
        const filename = pathParts.pop();
        const parentFolder = pathParts.join('/');

        if (filename) {
            const { data: files, error: listError } = await supabase.storage.from(bucket).list(parentFolder || undefined);
            
            if (!listError && files) {
                const caseInsensitiveMatch = files.find(f => f.name.toLowerCase() === filename.toLowerCase());
                if (caseInsensitiveMatch) {
                    const fallbackPath = parentFolder ? `${parentFolder}/${caseInsensitiveMatch.name}` : caseInsensitiveMatch.name;
                    console.log(`✅ Smart Fallback: Found match -> ${fallbackPath}`);
                    const fallbackResult = await supabase.storage.from(bucket).download(fallbackPath);
                    data = fallbackResult.data;
                    error = fallbackResult.error;
                } else {
                    console.error(`❌ Fallback failed: No case-insensitive match found for ${filename}`);
                }
            } else {
                console.error(`❌ List failed: ${listError?.message}`);
            }
        }
    }

    if (!error && data) {
        console.log(`✨ SUCCESS: Downloaded ${data.size} bytes`);
    } else {
        console.log(`💀 FINAL ERROR: ${error?.message || 'Unknown error'}`);
    }
}

async function runTests() {
    const bucket = 'onboarding-documents';
    
    // Case 1: The original failing path with spaces (encoded)
    // The server fix should decoded it and find it directly if case matches.
    const failingPath = 'documents/5321c6f6-578e-4168-9da8-060148e1587b/1775722874482/PIFS%20EPF%20-certificate_allotment.pdf';
    await verifyLogic(bucket, failingPath);

    // Case 2: The path with WRONG case (triggers fallback)
    const wrongCasePath = 'documents/5321c6f6-578e-4168-9da8-060148e1587b/1775722874482/PIFS EPF -CERTIFICATE_ALLOTMENT.pdf';
    await verifyLogic(bucket, wrongCasePath);
}

runTests();
